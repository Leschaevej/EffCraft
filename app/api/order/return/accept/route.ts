import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise from "../../../../lib/mongodb";
import nodemailer from "nodemailer";
import { ObjectId } from "mongodb";
import { notifyClients } from "../../../../lib/pusher-server";

const getBoxtalApiUrl = () => {
    return process.env.BOXTAL_ENV === "production"
        ? "https://api.boxtal.com"
        : "https://api.boxtal.build";
};

const PACKAGE_WEIGHT = 0.5;
const PACKAGE_LENGTH = 18;
const PACKAGE_WIDTH = 13;
const PACKAGE_HEIGHT = 8;

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || session.user.role !== "admin") {
            return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
        }

        const { orderId } = await req.json();
        if (!orderId) {
            return NextResponse.json({ error: "orderId manquant" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");

        const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
        if (!order) {
            return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
        }

        if (order.order.status !== "return_requested") {
            return NextResponse.json({ error: "Cette commande n'a pas de demande de retour en cours" }, { status: 400 });
        }

        const isProduction = process.env.BOXTAL_ENV === "production";
        const apiKey = isProduction ? process.env.BOXTAL_V3_PROD_KEY : process.env.BOXTAL_V3_TEST_KEY;
        const apiSecret = isProduction ? process.env.BOXTAL_V3_PROD_SECRET : process.env.BOXTAL_V3_TEST_SECRET;

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: "Configuration Boxtal manquante" }, { status: 500 });
        }

        const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
        const apiUrl = getBoxtalApiUrl();

        // Créer l'expédition de retour Boxtal
        const returnShipmentData = {
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
                    type: "RESIDENTIAL",
                    contact: {
                        firstName: order.shippingData?.prenom,
                        lastName: order.shippingData?.nom,
                        email: order.userEmail,
                        phone: order.shippingData?.telephone?.replace(/\+/g, "")
                    },
                    location: order.shippingData?.shippingMethod?.relayPoint ? {
                        street: order.shippingData.shippingMethod.relayPoint.address,
                        city: order.shippingData.shippingMethod.relayPoint.city,
                        postalCode: order.shippingData.shippingMethod.relayPoint.zipcode,
                        countryIsoCode: "FR"
                    } : {
                        street: order.shippingData?.rue,
                        city: order.shippingData?.ville,
                        postalCode: order.shippingData?.codePostal,
                        countryIsoCode: "FR"
                    }
                },
                toAddress: {
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
                service: {
                    operator: order.shippingData?.shippingMethod?.operator || "MONR",
                    code: order.shippingData?.shippingMethod?.serviceCode || "CpourToi"
                }
            },
            shippingOfferCode: `${order.shippingData?.shippingMethod?.operator || "MONR"}-${order.shippingData?.shippingMethod?.serviceCode || "CpourToi"}`
        };

        const createReturnResponse = await fetch(`${apiUrl}/shipping/v3.1/shipping-order`, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(returnShipmentData)
        });

        if (!createReturnResponse.ok) {
            const errorText = await createReturnResponse.text();
            return NextResponse.json({ error: "Impossible de créer l'expédition de retour", details: errorText }, { status: 500 });
        }

        const returnShipmentResult = await createReturnResponse.json();
        const returnShipmentId = returnShipmentResult.content?.id || returnShipmentResult.id;

        if (returnShipmentId) {
            await ordersCollection.updateOne(
                { _id: new ObjectId(orderId) },
                {
                    $set: {
                        "shippingData.boxtalReturnShipmentId": returnShipmentId,
                        "shippingData.originalBoxtalShipmentId": order.shippingData?.boxtalShipmentId
                    }
                }
            );
        }

        // Attendre que Boxtal génère le bordereau
        await new Promise(resolve => setTimeout(resolve, 3000));

        const labelResponse = await fetch(
            `${apiUrl}/shipping/v3.1/shipping-order/${returnShipmentId}/shipping-document`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Basic ${authString}`,
                    "Accept": "application/json"
                }
            }
        );

        let pdfBuffer: Buffer | null = null;
        if (labelResponse.ok) {
            const documentsData = await labelResponse.json();
            const doc = documentsData.content?.find((d: any) =>
                d.type === "LABEL" || d.type === "RETURN_LABEL" || d.type === "RETURN"
            );
            if (doc?.url) {
                const pdfResponse = await fetch(doc.url);
                if (pdfResponse.ok) {
                    pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
                }
            }
        }

        // Mettre à jour le statut
        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { "order.status": "return_preparing" } }
        );

        await notifyClients({
            type: "order_status_updated",
            data: { orderId, status: "return_preparing" }
        });

        // Envoyer le mail au client avec le bordereau
        const transporter = nodemailer.createTransport({
            host: "ssl0.ovh.net",
            port: 465,
            secure: true,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
        });

        const orderDate = new Date(order.order.createdAt).toLocaleDateString("fr-FR");
        const threadId = order.emailThreadId || `<order-${orderId}@effcraft.fr>`;
        const subject = order.emailSubject || `EffCraft - Retour de votre commande du ${orderDate}`;

        const mailOptions: any = {
            from: `"EffCraft" <${process.env.MAIL_USER}>`,
            to: order.userEmail,
            subject,
            inReplyTo: threadId,
            references: threadId,
            headers: {
                "X-Mailer": "EffCraft Mailer",
                "Organization": "EffCraft",
            },
            html: `
                <h2>Votre retour a été accepté !</h2>
                <p>Bonjour,</p>
                <p>Nous avons bien pris en compte votre demande de retour pour la commande du ${orderDate}.</p>
                <p>Vous trouverez votre bordereau de retour en pièce jointe. Imprimez-le et collez-le sur votre colis avant de le déposer en point relais.</p>
                <p>Une fois votre colis réceptionné, nous procéderons au traitement de votre retour.</p>
                <p>Cordialement,<br>L'équipe EffCraft</p>
            `,
        };

        if (pdfBuffer) {
            mailOptions.attachments = [{
                filename: `bordereau-retour-${orderId}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            }];
        }

        await transporter.sendMail(mailOptions);

        return NextResponse.json({ message: "Retour accepté, bordereau envoyé au client" });
    } catch (error) {
        console.error("Erreur acceptation retour:", error);
        return NextResponse.json({ error: "Erreur lors de l'acceptation du retour" }, { status: 500 });
    }
}
