import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";
import cloudinary from "../../lib/cloudinary";

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
    return getShippingPrices(searchParams);
}
async function getShippingPrices(searchParams: URLSearchParams) {
    try {
        const zipcode = searchParams.get('zipcode');
        const city = searchParams.get('city');
        const address = searchParams.get('address');
        const country = searchParams.get('country') || 'FR';

        if (!zipcode || !city) {
            return NextResponse.json(
                { error: "Code postal et ville requis" },
                { status: 400 }
            );
        }

        // Valider l'adresse avec l'API du gouvernement français
        const validationResult = await validateFrenchAddress(address, zipcode, city);

        if (validationResult.status === 'invalid') {
            return NextResponse.json(
                { error: "Adresse invalide. Veuillez vérifier votre saisie." },
                { status: 400 }
            );
        }

        // Vérifier la disponibilité des transporteurs selon la zone géographique
        const availableOptions = getAvailableShippingOptionsForZipcode(zipcode);

        return NextResponse.json({
            success: true,
            options: availableOptions,
            addressWarning: validationResult.status === 'unverified' ? validationResult.message : null
        });
    } catch (error: any) {
        console.error("Erreur calcul prix:", error);
        return getFallbackShippingOptions();
    }
}

type AddressValidationResult = {
    status: 'valid' | 'unverified' | 'invalid';
    message?: string;
};

async function validateFrenchAddress(address: string | null, zipcode: string, city: string): Promise<AddressValidationResult> {
    try {
        // Validation basique du code postal français (5 chiffres)
        if (!/^\d{5}$/.test(zipcode)) {
            return { status: 'invalid', message: 'Code postal invalide' };
        }

        // Si pas d'adresse précise, on valide juste le code postal et la ville
        const query = address ? `${address} ${zipcode} ${city}` : `${zipcode} ${city}`;
        const response = await fetch(
            `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`
        );

        if (!response.ok) {
            console.warn("Erreur API adresse.data.gouv.fr, validation désactivée");
            return {
                status: 'unverified',
                message: 'Votre adresse n\'a pas pu être vérifiée. Veuillez confirmer qu\'elle est correcte avant de continuer.'
            };
        }

        const data = await response.json();

        // Si aucun résultat mais que le format est correct, on accepte avec un warning
        // (adresses récentes, rurales, non référencées)
        if (!data.features || data.features.length === 0) {
            console.warn(`Adresse non trouvée dans l'API: ${query}, mais on accepte avec warning`);
            return {
                status: 'unverified',
                message: 'Votre adresse n\'a pas été trouvée dans notre base. Veuillez vérifier qu\'elle est correcte avant de continuer.'
            };
        }

        const result = data.features[0];
        const resultZipcode = result.properties.postcode;

        // Vérifier que le code postal correspond (tolérance)
        if (resultZipcode !== zipcode) {
            // Si le département correspond (2 premiers chiffres), on accepte avec warning
            if (resultZipcode.substring(0, 2) === zipcode.substring(0, 2)) {
                console.warn(`Code postal proche: ${zipcode} vs ${resultZipcode}, accepté avec warning`);
                return {
                    status: 'unverified',
                    message: `Le code postal trouvé (${resultZipcode}) diffère légèrement du vôtre (${zipcode}). Veuillez vérifier votre adresse.`
                };
            }
            // Code postal très différent, on demande confirmation
            console.warn(`Code postal très différent: ${zipcode} vs ${resultZipcode}`);
            return {
                status: 'unverified',
                message: 'Votre adresse n\'a pas été trouvée dans notre base. Veuillez vérifier qu\'elle est correcte avant de continuer.'
            };
        }

        // Score de confiance : demander confirmation si pas parfait
        const score = result.properties.score;
        if (score > 0.7) {
            return { status: 'valid' }; // Adresse parfaitement validée
        } else {
            // Score pas assez élevé, on demande confirmation
            return {
                status: 'unverified',
                message: 'Votre adresse est similaire à une adresse connue mais pas exactement identique. Veuillez la vérifier.'
            };
        }

    } catch (error) {
        console.error("Erreur validation adresse:", error);
        // En cas d'erreur, on laisse passer avec un warning
        return {
            status: 'unverified',
            message: 'Impossible de vérifier votre adresse pour le moment. Veuillez confirmer qu\'elle est correcte.'
        };
    }
}

function getAvailableShippingOptionsForZipcode(zipcode: string) {
    // Définir toutes les options possibles
    const allOptions = [
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

    const dept = zipcode.substring(0, 2);

    // Départements ruraux/zones difficiles d'accès où Chronopost et Relais Colis sont limités
    const ruralDepartments = [
        '04', '05', '09', '15', '19', '23', '48', '65', '66', '2A', '2B',  // Zones montagneuses/isolées
        '50', '52', '55', '58', '70', '88', '89', // Zones rurales du centre et nord-est
    ];

    // Chronopost dessert principalement les grandes villes et zones urbaines
    // On le désactive pour les zones rurales/montagneuses
    const isRuralArea = ruralDepartments.includes(dept);

    if (isRuralArea) {
        // Zones rurales : uniquement Mondial Relay et Colissimo (les plus fiables)
        return allOptions.filter(opt =>
            opt.id === "MONR-CpourToi" || opt.id === "POFR-ColissimoAccess"
        );
    }

    // Grandes métropoles : toutes les options
    const majorCitiesZipcodes = [
        '75', '69', '13', '31', '44', '33', '59', '67', '35', '34', // Paris, Lyon, Marseille, Toulouse, etc.
        '92', '93', '94', '95', '77', '78', '91' // Île-de-France
    ];

    if (majorCitiesZipcodes.includes(dept)) {
        // Toutes les options disponibles
        return allOptions;
    }

    // Zones intermédiaires : pas de Chronopost mais le reste oui
    return allOptions.filter(opt => opt.id !== "CHRP-Chrono18");
}

function getFallbackShippingOptions() {
    // Options de secours minimales (les plus fiables)
    const fallbackOptions = [
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
            id: "POFR-ColissimoAccess",
            name: "Colissimo",
            service: "Livraison à domicile (2 à 3 jours)",
            price: FIXED_PRICES["POFR-ColissimoAccess"],
            currency: "EUR",
            logo: "/delivery/colissimo.webp",
            operator: "POFR",
            serviceCode: "ColissimoAccess",
            type: "home"
        }
    ];

    return NextResponse.json({
        success: true,
        options: fallbackOptions
    });
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
        const updateData: any = {};
        if (trackingResponse.ok) {
            const trackingData = await trackingResponse.json();
            const trackingStatus = trackingData.content?.[0]?.status;
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
            } else if (shipmentData.content?.status === "PENDING" && order.status === "preparing") {
                ourStatus = "ready";
                updateData.status = "ready";
                if (!order.readyAt) {
                    updateData.readyAt = new Date();
                }
            }
            if (order.status === "preparing" && ourStatus !== "preparing") {
                if (order.products && order.products.length > 0) {
                    const imagesToDelete: string[] = [];
                    order.products.forEach((p: any) => {
                        if (p.images && p.images.length > 1) {
                            imagesToDelete.push(...p.images.slice(1));
                        }
                    });
                    if (imagesToDelete.length > 0) {
                        for (const imageUrl of imagesToDelete) {
                            try {
                                const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
                                if (match && match[1]) {
                                    const publicId = match[1];
                                    await cloudinary.uploader.destroy(publicId);
                                }
                            } catch (error) {
                                console.error("Erreur suppression image Cloudinary:", error);
                            }
                        }
                    }
                    const cleanedProducts = order.products.map((p: any) => ({
                        name: p.name,
                        price: p.price,
                        images: p.images && p.images.length > 0 ? [p.images[0]] : []
                    }));

                    updateData.products = cleanedProducts;
                }
            }
        }
        const updateQuery: any = { $set: updateData };
        if (ourStatus === "delivered") {
            updateQuery.$unset = {
                shippingData: "",
                billingData: "",
                boxtalShipmentId: "",
                trackingNumber: ""
            };
        }
        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            updateQuery
        );
        return NextResponse.json({
            success: true,
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
    if (action === 'return-label') {
        return getReturnLabel(req);
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
        console.log("📦 Création expédition pour commande:", orderId);
        console.log("📦 Shipping method:", order.shippingMethod);
        console.log("📦 Shipping data:", order.shippingData);

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
                        number: process.env.SHIPPER_NUMBER,
                        street: decodeURIComponent(process.env.SHIPPER_STREET || ""),
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
                        number: process.env.SHIPPER_NUMBER,
                        street: decodeURIComponent(process.env.SHIPPER_STREET || ""),
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
            console.log("📦 Livraison en point relais détectée, operator:", operator);
            console.log("📦 Relay point ID:", order.shippingData.relayPoint.id);

            if (operator === "MONR") {
                const pickupCode = process.env.MONDIAL_RELAY_PICKUP_CODE;
                console.log("📦 Mondial Relay pickup code:", pickupCode);
                if (!pickupCode) {
                    console.error("❌ MONDIAL_RELAY_PICKUP_CODE n'est pas défini dans .env");
                }
                shipmentData.shipment.pickupPointCode = pickupCode;
            } else if (operator === "SOGP") {
                const pickupCode = process.env.RELAIS_COLIS_PICKUP_CODE;
                console.log("📦 Relais Colis pickup code:", pickupCode);
                if (!pickupCode) {
                    console.error("❌ RELAIS_COLIS_PICKUP_CODE n'est pas défini dans .env");
                }
                shipmentData.shipment.pickupPointCode = pickupCode;
            }
            console.log("📦 Final shipmentData.shipment.pickupPointCode:", shipmentData.shipment.pickupPointCode);
        } else {
            console.log("📦 Livraison à domicile (pas de relayPoint)");
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
                        trackingNumber: shipmentResult.content.shipmentId
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
        if (order.status !== "preparing") {
            await ordersCollection.updateOne(
                { _id: new ObjectId(orderId) },
                {
                    $set: {
                        status: "preparing",
                        preparingAt: new Date()
                    }
                }
            );
            const { notifyClients } = await import("../cart/route");
            await notifyClients({
                type: "order_status_updated",
                data: {
                    orderId: orderId,
                    status: "preparing"
                }
            });
        }
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
async function getReturnLabel(req: NextRequest) {
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
            console.error("Erreur récupération documents Boxtal:", errorText);
            return NextResponse.json(
                { error: "Impossible de récupérer les documents", details: errorText },
                { status: labelResponse.status }
            );
        }
        const documentsData = await labelResponse.json();
        const returnDocument = documentsData.content?.find((doc: any) =>
            doc.type === "RETURN_LABEL" || doc.type === "RETURN"
        );
        if (!returnDocument?.url) {
            return NextResponse.json(
                { error: "Aucun bordereau de retour disponible pour cette commande" },
                { status: 404 }
            );
        }
        const pdfResponse = await fetch(returnDocument.url);
        if (!pdfResponse.ok) {
            return NextResponse.json(
                { error: "Erreur lors du téléchargement du bordereau de retour" },
                { status: 500 }
            );
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="bordereau-retour-${orderId}.pdf"`,
            },
        });
    } catch (error: any) {
        console.error("Erreur récupération bordereau retour:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération du bordereau de retour" },
            { status: 500 }
        );
    }
}