import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";

const getBoxtalApiUrl = () => {
    return process.env.BOXTAL_ENV === "production"
        ? "https://api.boxtal.com"
        : "https://api.boxtal.build";
};
const PACKAGE_WEIGHT = 0.5;
const PACKAGE_LENGTH = 18;
const PACKAGE_WIDTH = 13;
const PACKAGE_HEIGHT = 8;
const FIXED_PRICES = {
    "MONR-CpourToi": 5.90, // Coûts réels 3.91€
    "SOGP-RelaisColis": 5.90, // Coûts réels Relais Colis 4.25€
    "POFR-ColissimoAccess": 9.90, // Coûts réels 8.63€
    "CHRP-Chrono18": 12.90 // Coûts réels 11.02€
};
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    if (action === 'relay') {
        return getRelayPoints(searchParams);
    }
    if (action === 'sync-status') {
        return syncBoxtalStatus(searchParams);
    }
    return getShippingPrices();
}
async function getShippingPrices() {
    try {
        const shippingOptions = [
            {
                id: "MONR-CpourToi",
                name: "Mondial Relay",
                service: "Livraison en point relais (3 à 4 jours)",
                price: FIXED_PRICES["MONR-CpourToi"],
                currency: "EUR",
                logo: "/delivery/mondialRelay.webp",
                operator: "MONR",
                serviceCode: "CpourToi",
                type: "relay"
            },
            {
                id: "SOGP-RelaisColis",
                name: "Relais Colis",
                service: "Livraison en point relais (6 jours)",
                price: FIXED_PRICES["SOGP-RelaisColis"],
                currency: "EUR",
                logo: "/delivery/relayColis.webp",
                operator: "SOGP",
                serviceCode: "RelaisColis",
                type: "relay"
            },
            {
                id: "POFR-ColissimoAccess",
                name: "Colissimo",
                service: "Livraison à domicile (2 à 3 jours)",
                price: FIXED_PRICES["POFR-ColissimoAccess"],
                currency: "EUR",
                logo: "/delivery/colissimo.webp",
                operator: "POFR",
                serviceCode: "ColissimoAccess",
                type: "home"
            },
            {
                id: "CHRP-Chrono18",
                name: "Chronopost",
                service: "Livraison express à domicile (24h avant 18h)",
                price: FIXED_PRICES["CHRP-Chrono18"],
                currency: "EUR",
                logo: "/delivery/chronopost.webp",
                operator: "CHRP",
                serviceCode: "Chrono18",
                type: "express"
            }
        ];
        return NextResponse.json({
            success: true,
            options: shippingOptions
        });
    } catch (error: any) {
        console.error("Erreur calcul prix:", error);
        return NextResponse.json(
            { error: "Erreur serveur lors du calcul des frais de port" },
            { status: 500 }
        );
    }
}
async function syncBoxtalStatus(searchParams: URLSearchParams) {
    try {
        const orderId = searchParams.get('orderId');
        if (!orderId) {
            return NextResponse.json(
                { error: "ID de commande manquant" },
                { status: 400 }
            );
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");
        const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });

        if (!order || !order.boxtalShipmentId) {
            return NextResponse.json(
                { error: "Commande ou expédition Boxtal introuvable" },
                { status: 404 }
            );
        }

        const isProduction = process.env.BOXTAL_ENV === "production";
        const apiKey = isProduction ? process.env.BOXTAL_V3_PROD_KEY : process.env.BOXTAL_V3_TEST_KEY;
        const apiSecret = isProduction ? process.env.BOXTAL_V3_PROD_SECRET : process.env.BOXTAL_V3_TEST_SECRET;

        if (!apiKey || !apiSecret) {
            return NextResponse.json(
                { error: "Configuration Boxtal manquante" },
                { status: 500 }
            );
        }

        const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const apiUrl = getBoxtalApiUrl();

        // Récupérer les infos de l'expédition
        const response = await fetch(
            `${apiUrl}/shipping/v3.1/shipping-order/${order.boxtalShipmentId}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Basic ${authString}`,
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erreur récupération statut Boxtal:", errorText);
            return NextResponse.json(
                { error: "Impossible de récupérer le statut Boxtal" },
                { status: response.status }
            );
        }

        const shipmentData = await response.json();
        const boxtalStatus = shipmentData.content?.status;

        // Récupérer le tracking détaillé
        const trackingResponse = await fetch(
            `${apiUrl}/shipping/v3.1/shipping-order/${order.boxtalShipmentId}/tracking`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Basic ${authString}`,
                    "Accept": "application/json"
                }
            }
        );

        let ourStatus = order.status;
        const updateData: any = { boxtalStatus };

        if (trackingResponse.ok) {
            const trackingData = await trackingResponse.json();
            const trackingStatus = trackingData.content?.[0]?.status;

            // Mapper les statuts Boxtal vers nos statuts
            if (trackingStatus === "DELIVERED") {
                ourStatus = "delivered";
                updateData.status = "delivered";
                if (!order.deliveredAt) {
                    updateData.deliveredAt = new Date();
                }
            } else if (trackingStatus === "OUT_FOR_DELIVERY") {
                ourStatus = "out_for_delivery";
                updateData.status = "out_for_delivery";
            } else if (trackingStatus === "IN_TRANSIT") {
                ourStatus = "in_transit";
                updateData.status = "in_transit";
            } else if (boxtalStatus === "PENDING" && order.status === "preparing") {
                // Le colis a été scanné au point relais
                ourStatus = "ready";
                updateData.status = "ready";
                if (!order.readyAt) {
                    updateData.readyAt = new Date();
                }
            }
        }

        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: updateData }
        );

        return NextResponse.json({
            success: true,
            boxtalStatus,
            status: ourStatus
        });
    } catch (error: any) {
        console.error("Erreur synchronisation statut:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la synchronisation" },
            { status: 500 }
        );
    }
}

async function getRelayPoints(searchParams: URLSearchParams) {
    try {
        const zipcode = searchParams.get('zipcode');
        const city = searchParams.get('city');
        const country = searchParams.get('country') || 'FR';
        const address = searchParams.get('address');
        const carrier = searchParams.get('carrier');
        if (!zipcode || !city) {
            return NextResponse.json(
                { error: "Code postal et ville requis" },
                { status: 400 }
            );
        }
        const isProduction = process.env.BOXTAL_ENV === "production";
        const apiKey = isProduction ? process.env.BOXTAL_V3_PROD_KEY : process.env.BOXTAL_V3_TEST_KEY;
        const apiSecret = isProduction ? process.env.BOXTAL_V3_PROD_SECRET : process.env.BOXTAL_V3_TEST_SECRET;
        if (!apiKey || !apiSecret) {
            return NextResponse.json(
                { error: "Configuration Boxtal manquante" },
                { status: 500 }
            );
        }
        const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const carrierToNetwork: { [key: string]: string } = {
            "MONR": "MONR_NETWORK",
            "SOGP": "SOGP_NETWORK",
            "CHRP": "CHRP_NETWORK",
            "COPR": "COPR_NETWORK"
        };
        const params = new URLSearchParams({
            countryIsoCode: country,
            postalCode: zipcode,
            city: city,
        });
        if (address) {
            const streetParts = address.split(' ');
            if (streetParts.length > 1) {
                params.append("number", streetParts[0]);
                params.append("street", streetParts.slice(1).join(' '));
            } else {
                params.append("street", address);
            }
        }
        if (carrier && carrierToNetwork[carrier]) {
            params.append("searchNetworks", carrierToNetwork[carrier]);
        } else {
            params.append("searchNetworks", "MONR_NETWORK");
            params.append("searchNetworks", "SOGP_NETWORK");
        }
        const apiUrl = getBoxtalApiUrl();
        const response = await fetch(`${apiUrl}/shipping/v3.2/parcel-point-by-network?${params.toString()}`, {
            method: "GET",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Accept": "application/json"
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: "Erreur lors de la récupération des points relais", details: errorText },
                { status: response.status }
            );
        }
        const data = await response.json();
        const parcelPoints = (data.content || []).map((item: any) => {
            const point = item.parcelPoint || item;
            const location = point?.location;
            if (!point || !location) {
                return null;
            }
            return {
                id: point.code,
                name: point.name,
                address: `${location.number || ''} ${location.street || ''}`.trim(),
                zipcode: location.postalCode,
                city: location.city,
                country: location.countryIsoCode,
                latitude: parseFloat(location.position?.latitude || 0),
                longitude: parseFloat(location.position?.longitude || 0),
                carrier: point.compatibleNetworks?.[0] || carrier,
                openingHours: point.openingDays,
                distance: item.distanceFromSearchLocation
            };
        }).filter((point: any) => point !== null);
        return NextResponse.json({
            success: true,
            points: parcelPoints
        });
    } catch (error) {
        console.error("Erreur points relais:", error);
        return NextResponse.json(
            { error: "Erreur serveur lors de la récupération des points relais" },
            { status: 500 }
        );
    }
}
export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    if (action === 'label') {
        return getShippingLabel(req);
    }
    return createShipment(req);
}
async function createShipment(req: NextRequest) {
    try {
        const { orderId } = await req.json();
        if (!orderId) {
            return NextResponse.json(
                { error: "ID de commande manquant" },
                { status: 400 }
            );
        }
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");
        const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
        if (!order) {
            return NextResponse.json(
                { error: "Commande introuvable" },
                { status: 404 }
            );
        }
        const isProduction = process.env.BOXTAL_ENV === "production";
        const apiKey = isProduction ? process.env.BOXTAL_V3_PROD_KEY : process.env.BOXTAL_V3_TEST_KEY;
        const apiSecret = isProduction ? process.env.BOXTAL_V3_PROD_SECRET : process.env.BOXTAL_V3_TEST_SECRET;
        if (!apiKey || !apiSecret) {
            console.error("Clés API Boxtal manquantes");
            return NextResponse.json(
                { error: "Configuration Boxtal manquante" },
                { status: 500 }
            );
        }
        const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const shipmentData: any = {
            shipment: {
                packages: [{
                    type: "PARCEL",
                    weight: PACKAGE_WEIGHT,
                    length: PACKAGE_LENGTH,
                    width: PACKAGE_WIDTH,
                    height: PACKAGE_HEIGHT,
                    value: {
                        value: order.products.reduce((sum: number, p: any) => sum + p.price, 0),
                        currency: "EUR"
                    },
                    content: {
                        id: "content:v1:40150",
                        description: "Bijoux fantaisie"
                    }
                }],
                fromAddress: {
                    type: "BUSINESS",
                    contact: {
                        company: process.env.COMPANY_NAME,
                        firstName: process.env.SHIPPER_FIRST_NAME,
                        lastName: process.env.SHIPPER_LAST_NAME,
                        email: process.env.SHIPPER_EMAIL,
                        phone: process.env.SHIPPER_PHONE
                    },
                    location: {
                        street: decodeURIComponent(process.env.SHIPPER_STREET || ""),
                        number: 1,
                        city: process.env.SHIPPER_CITY,
                        postalCode: process.env.SHIPPER_POSTAL_CODE || "13100",
                        countryIsoCode: process.env.SHIPPER_COUNTRY
                    }
                },
                toAddress: {
                    type: "RESIDENTIAL",
                    contact: {
                        firstName: order.shippingData?.prenom,
                        lastName: order.shippingData?.nom,
                        email: order.userEmail,
                        phone: order.shippingData?.telephone?.replace(/\+/g, '')
                    },
                    location: {
                        street: order.shippingData?.rue,
                        city: order.shippingData?.ville,
                        postalCode: order.shippingData?.codePostal || "13100",
                        countryIsoCode: "FR"
                    }
                },
                returnAddress: {
                    type: "BUSINESS",
                    contact: {
                        company: process.env.COMPANY_NAME,
                        firstName: process.env.SHIPPER_FIRST_NAME,
                        lastName: process.env.SHIPPER_LAST_NAME,
                        email: process.env.SHIPPER_EMAIL,
                        phone: process.env.SHIPPER_PHONE
                    },
                    location: {
                        street: decodeURIComponent(process.env.SHIPPER_STREET || ""),
                        number: 1,
                        city: process.env.SHIPPER_CITY,
                        postalCode: process.env.SHIPPER_POSTAL_CODE || "13100",
                        countryIsoCode: process.env.SHIPPER_COUNTRY
                    }
                }
            },
            shippingOfferCode: `${order.shippingMethod?.operator || "MONR"}-${order.shippingMethod?.serviceCode || "CpourToi"}`,
            labelType: "PDF_A4",
            insured: false
        };
        if (order.shippingData?.relayPoint) {
            shipmentData.shipment.dropOffPointCode = order.shippingData.relayPoint.id;
            const operator = order.shippingMethod?.operator || "MONR";
            if (operator === "MONR") {
                shipmentData.shipment.pickupPointCode = process.env.MONDIAL_RELAY_PICKUP_CODE;
            } else if (operator === "SOGP") {
                shipmentData.shipment.pickupPointCode = process.env.RELAIS_COLIS_PICKUP_CODE;
            }
        }
        const apiUrl = getBoxtalApiUrl();
        const response = await fetch(`${apiUrl}/shipping/v3.1/shipping-order`, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(shipmentData)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erreur Boxtal:", errorText);
            return NextResponse.json(
                { error: "Erreur lors de la création de l'expédition", details: errorText },
                { status: response.status }
            );
        }
        const shipmentResult = await response.json();
        if (shipmentResult.content?.id) {
            await ordersCollection.updateOne(
                { _id: new ObjectId(orderId) },
                {
                    $set: {
                        boxtalShipmentId: shipmentResult.content.id,
                        boxtalStatus: shipmentResult.content.status || "PENDING",
                        trackingNumber: shipmentResult.content.shipmentId,
                    }
                }
            );
            return NextResponse.json({
                success: true,
                shipmentId: shipmentResult.content.id,
                message: "Commande Boxtal créée avec succès"
            });
        }
        return NextResponse.json(
            { error: "Impossible de créer l'expédition", details: shipmentResult },
            { status: 500 }
        );
    } catch (error: any) {
        console.error("Erreur création expédition:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la création de l'expédition" },
            { status: 500 }
        );
    }
}
async function getShippingLabel(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || session.user.role !== "admin") {
            return NextResponse.json(
                { error: "Non autorisé" },
                { status: 403 }
            );
        }
        const { orderId } = await req.json();
        if (!orderId) {
            return NextResponse.json(
                { error: "ID de commande manquant" },
                { status: 400 }
            );
        }
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");
        const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
        if (!order) {
            return NextResponse.json(
                { error: "Commande introuvable" },
                { status: 404 }
            );
        }
        if (!order.boxtalShipmentId) {
            return NextResponse.json(
                { error: "Aucune expédition Boxtal associée à cette commande" },
                { status: 404 }
            );
        }
        const isProduction = process.env.BOXTAL_ENV === "production";
        const apiKey = isProduction ? process.env.BOXTAL_V3_PROD_KEY : process.env.BOXTAL_V3_TEST_KEY;
        const apiSecret = isProduction ? process.env.BOXTAL_V3_PROD_SECRET : process.env.BOXTAL_V3_TEST_SECRET;
        if (!apiKey || !apiSecret) {
            return NextResponse.json(
                { error: "Configuration Boxtal manquante" },
                { status: 500 }
            );
        }
        const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const apiUrl = getBoxtalApiUrl();
        const labelResponse = await fetch(
            `${apiUrl}/shipping/v3.1/shipping-order/${order.boxtalShipmentId}/shipping-document`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Basic ${authString}`,
                    "Accept": "application/json"
                }
            }
        );
        if (!labelResponse.ok) {
            const errorText = await labelResponse.text();
            console.error("Erreur récupération document Boxtal:", errorText);
            return NextResponse.json(
                { error: "Impossible de récupérer le bordereau", details: errorText },
                { status: labelResponse.status }
            );
        }
        const documentsData = await labelResponse.json();
        console.log("Documents Boxtal:", JSON.stringify(documentsData, null, 2));
        const labelDocument = documentsData.content?.find((doc: any) => doc.type === "LABEL");
        if (!labelDocument?.url) {
            return NextResponse.json(
                { error: "Aucun bordereau disponible pour cette commande" },
                { status: 404 }
            );
        }
        const pdfResponse = await fetch(labelDocument.url);
        if (!pdfResponse.ok) {
            return NextResponse.json(
                { error: "Erreur lors du téléchargement du bordereau" },
                { status: 500 }
            );
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();
        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            {
                $set: {
                    status: "preparing",
                    preparingAt: new Date()
                }
            }
        );
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="bordereau-${orderId}.pdf"`,
            },
        });
    } catch (error: any) {
        console.error("Erreur récupération bordereau:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération du bordereau" },
            { status: 500 }
        );
    }
}