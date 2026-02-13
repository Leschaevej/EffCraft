import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { notifyClients } from "../../../lib/pusher-server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import cloudinary from "../../../lib/cloudinary";

function verifySignature(payload: string, signature: string, secret: string): boolean {
    const computedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
    return computedSignature === signature;
}
export async function GET(req: NextRequest) {
    console.log("🔔 Webhook GET appelé à", new Date().toISOString());
    console.log("🔔 Headers:", Object.fromEntries(req.headers.entries()));
    return NextResponse.json({
        message: "Webhook Boxtal - Utilisez POST pour envoyer des événements",
        timestamp: new Date().toISOString()
    });
}
export async function POST(req: NextRequest) {
    const timestamp = new Date().toISOString();
    console.log("🔔 ========================================");
    console.log("🔔 WEBHOOK BOXTAL APPELÉ à", timestamp);
    console.log("🔔 ========================================");
    try {
        const rawBody = await req.text();
        console.log("🔔 Body reçu:", rawBody);
        const body = JSON.parse(rawBody);
        console.log("🔔 Body parsé:", JSON.stringify(body, null, 2));
        const signature = req.headers.get("x-bxt-signature");
        const webhookSecret = process.env.BOXTAL_WEBHOOK_TOKEN;
        if (!webhookSecret) {
            console.error("❌ BOXTAL_WEBHOOK_TOKEN non configuré dans .env");
            return NextResponse.json(
                { error: "Configuration manquante" },
                { status: 500 }
            );
        }
        const isSimulation = body.event && body.shipment;
        if (!isSimulation) {
            if (!signature) {
                console.error("❌ Pas de signature dans le webhook");
                return NextResponse.json(
                    { error: "Signature manquante" },
                    { status: 401 }
                );
            }
            const isValid = verifySignature(rawBody, signature, webhookSecret);
            if (!isValid) {
                console.error("❌ Signature invalide");
                return NextResponse.json(
                    { error: "Signature invalide" },
                    { status: 401 }
                );
            }
        } else {
            console.log("🧪 Mode simulation détecté - signature ignorée");
        }
        let shipmentId = body.shipmentId || body.shippingOrderId;
        let status = body.status;
        let trackingNumber = body.trackingNumber;
        let eventType = body.eventType || body.type;
        if (isSimulation) {
            status = body.event;
            shipmentId = body.shipment.id;
            trackingNumber = body.shipment.trackingNumber;
            eventType = "TRACKING_CHANGED";
            console.log("🧪 Données simulation:", { status, shipmentId, trackingNumber });
        }
        else if (body.payload && body.payload.trackings && Array.isArray(body.payload.trackings) && body.payload.trackings.length > 0) {
            const tracking = body.payload.trackings[0];
            status = tracking.status;
            trackingNumber = tracking.trackingNumber;
            console.log("📦 TRACKING_CHANGED détecté:", { status, trackingNumber, shipmentId });
        }
        else if (body.content) {
            if (Array.isArray(body.content) && body.content.length > 0) {
                const tracking = body.content[0];
                status = tracking.status;
                trackingNumber = tracking.trackingNumber;
                shipmentId = shipmentId || body.id;
            } else if (typeof body.content === 'object') {
                shipmentId = shipmentId || body.content.shipmentId || body.content.id;
                status = status || body.content.status;
                trackingNumber = trackingNumber || body.content.trackingNumber;
            }
        }
        if (!shipmentId) {
            console.warn("⚠️ shipmentId manquant dans le webhook (événement de test ?)");
            console.warn("📋 Body complet reçu:", JSON.stringify(body, null, 2));
            console.warn("📋 eventType:", eventType);
            console.warn("📋 status:", status);
            return NextResponse.json({
                success: true,
                message: "Événement de test reçu"
            });
        }
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");
        const order = await ordersCollection.findOne({ "shippingData.boxtalShipmentId": shipmentId });
        if (!order) {
            console.warn(`Commande introuvable pour shipmentId: ${shipmentId}`);
            return NextResponse.json({ success: true, message: "Commande introuvable" });
        }
        const updateData: any = {};
        updateData["shippingData.boxtalStatus"] = status;
        updateData["shippingData.boxtalLastUpdate"] = new Date();
        const isReturn = order.order.status === "return_requested" || order.order.status?.startsWith("return_");
        if (isReturn) {
            console.log(`🔄 Retour : statut actuel ${order.order.status}, nouveau statut Boxtal: ${status}`);
            if (status === "ANNOUNCED" || status === "PENDING" || status === "READY_TO_SHIP" || status === "AT_PICKUP_LOCATION" || status === "PICKED_UP") {
                if (order.order.status === "return_requested") {
                }
            } else if (status === "SHIPPED" || status === "IN_TRANSIT") {
                if (["return_requested"].includes(order.order.status)) {
                    updateData["order.status"] = "return_in_transit";
                }
            } else if (status === "DELIVERED" || status === "AVAILABLE_FOR_WITHDRAWAL") {
                if (order.order.status !== "return_delivered") {
                    updateData["order.status"] = "return_delivered";
                }
            }
            console.log(`🔄 Retour : mise à jour boxtalStatus à ${status}, order.status à ${updateData["order.status"] || order.order.status}`);
        } else {
            console.log(`📦 Statut actuel de la commande: ${order.order.status}, Nouveau statut Boxtal: ${status}`);
            if (status === "ANNOUNCED" || status === "PENDING" || status === "READY_TO_SHIP" || status === "AT_PICKUP_LOCATION" || status === "PICKED_UP") {
                if (order.order.status === "paid") {
                    updateData["order.status"] = "preparing";
                    updateData["order.preparingAt"] = new Date();
                }
                if (trackingNumber) {
                    updateData["shippingData.trackingNumber"] = trackingNumber;
                }
            }
            else if (status === "SHIPPED" || status === "IN_TRANSIT") {
                if (["paid", "preparing"].includes(order.order.status)) {
                    updateData["order.status"] = "in_transit";
                }
                if (trackingNumber && !order.shippingData?.trackingNumber) {
                    updateData["shippingData.trackingNumber"] = trackingNumber;
                }
            }
            else if (status === "DELIVERED" || status === "AVAILABLE_FOR_WITHDRAWAL") {
                if (order.order.status !== "delivered") {
                    updateData["order.status"] = "delivered";
                    updateData["order.deliveredAt"] = new Date();
                }
            }
            else if (status === "CANCELLED" || status === "RETURNED") {
                updateData["order.status"] = "cancelled";
            }
            const hasStatusUpdate = updateData["order.status"] !== undefined;
            if (!hasStatusUpdate) {
                console.log(`⚠️ Pas de changement de statut commande - statut Boxtal ${status} reçu, commande déjà en ${order.order.status}`);
            } else {
                console.log(`✅ Mise à jour prévue:`, JSON.stringify(updateData, null, 2));
            }
        }
        if (order.order.status === "preparing" && updateData["order.status"] && updateData["order.status"] !== "preparing") {
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
                                await cloudinary.uploader.destroy(match[1]);
                            }
                        } catch (error) {
                            console.error("Erreur suppression image Cloudinary:", error);
                        }
                    }
                }
                updateData.products = order.products.map((p: any) => ({
                    name: p.name,
                    price: p.price,
                    image: p.images?.[0] || "",
                }));
            }
        }
        const updateQuery: any = { $set: updateData };
        if (updateData["order.status"] === "delivered") {
            delete updateData["shippingData.boxtalStatus"];
            delete updateData["shippingData.boxtalLastUpdate"];
            delete updateData["shippingData.trackingNumber"];
            updateQuery.$unset = {
                shippingData: "",
                billingData: ""
            };
        }
        await ordersCollection.updateOne(
            { _id: new ObjectId(order._id) },
            updateQuery
        );
        await notifyClients({
            type: "order_status_updated",
            data: {
                orderId: order._id.toString(),
                status: updateData["order.status"] || order.order.status,
                boxtalStatus: updateData["shippingData.boxtalStatus"]
            }
        });
        if (updateData["order.status"] === "delivered" && order.order.status !== "delivered") {
            try {
                const orderDate = new Date(order.order.createdAt).toLocaleDateString("fr-FR");
                const productsList = order.products.map((p: any) => `<li>${p.name}</li>`).join("");
                const relayPoint = order.shippingData?.shippingMethod?.relayPoint;
                const deliveryAddress = relayPoint
                    ? `<p><strong>${relayPoint.name}</strong></p><p>${relayPoint.address}</p><p>${relayPoint.zipcode} ${relayPoint.city}</p>`
                    : `<p><strong>${order.shippingData?.prenom || ''} ${order.shippingData?.nom || ''}</strong></p><p>${order.shippingData?.rue || ''}</p><p>${order.shippingData?.codePostal || ''} ${order.shippingData?.ville || ''}</p>`;
                const billingAddress = order.billingData && order.billingData !== "same"
                    ? `<h3>Adresse de facturation</h3><p><strong>${order.billingData.prenom || ''} ${order.billingData.nom || ''}</strong></p><p>${order.billingData.rue || ''}</p><p>${order.billingData.codePostal || ''} ${order.billingData.ville || ''}</p>`
                    : '';
                const transporter = nodemailer.createTransport({
                    host: "ssl0.ovh.net",
                    port: 465,
                    secure: true,
                    auth: {
                        user: process.env.MAIL_USER,
                        pass: process.env.MAIL_PASSWORD,
                    },
                });
                await transporter.sendMail({
                    from: process.env.MAIL_USER,
                    to: order.userEmail,
                    subject: `EffCraft - Votre commande du ${orderDate} a été livrée !`,
                    html: `
                        <h2>Votre commande a été livrée !</h2>
                        <p>Bonjour,</p>
                        <p>Nous avons le plaisir de vous informer que votre commande du ${orderDate} a bien été livrée.</p>
                        <h3>Adresse de livraison</h3>
                        ${deliveryAddress}
                        ${billingAddress}
                        <h3>Articles</h3>
                        <ul>${productsList}</ul>
                        <p>Nous espérons que vos articles vous plairont ! Si vous avez la moindre question ou le moindre souci, n'hésitez pas à nous contacter.</p>
                        <p>Un grand merci pour votre confiance et à très bientôt sur EffCraft !</p>
                        <p>Cordialement,<br>L'équipe EffCraft</p>
                    `,
                });
            } catch (mailError) {
                console.error("Erreur envoi mail de livraison:", mailError);
            }
        }
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erreur webhook Boxtal:", error);
        return NextResponse.json(
            { error: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}