import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";
import cloudinary from "../../../lib/cloudinary";
import { notifyClients } from "../../../lib/pusher-server";
import crypto from "crypto";

// Fonction pour vérifier la signature HMAC SHA256
function verifySignature(payload: string, signature: string, secret: string): boolean {
    const computedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
    return computedSignature === signature;
}

export async function POST(req: NextRequest) {
    try {
        // Récupérer le body brut pour la vérification de signature
        const rawBody = await req.text();
        const body = JSON.parse(rawBody);

        // Vérifier la signature si présente (TEMPORAIREMENT DÉSACTIVÉ POUR TESTS)
        const signature = req.headers.get("x-bxt-signature");
        const webhookSecret = process.env.BOXTAL_TEST_SECRET;

        // TEMPORAIRE : Signature désactivée pour permettre la création de souscription
        /*
        if (signature && webhookSecret) {
            const isValid = verifySignature(rawBody, signature, webhookSecret);
            if (!isValid) {
                console.error("Signature invalide");
                return NextResponse.json(
                    { error: "Signature invalide" },
                    { status: 401 }
                );
            }
        } else {
            console.warn("⚠️ Signature non vérifiée (pas de secret configuré ou pas de signature)");
        }
        */

        // Extraire les données - la structure peut varier selon l'événement
        let shipmentId = body.shipmentId;
        let status = body.status;
        let trackingNumber = body.trackingNumber;
        const eventType = body.eventType;

        // Si c'est un événement TRACKING_CHANGED, les données peuvent être dans content
        if (body.content) {
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
            console.error("shipmentId manquant dans le webhook");
            return NextResponse.json(
                { error: "shipmentId manquant" },
                { status: 400 }
            );
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");
        const order = await ordersCollection.findOne({ boxtalShipmentId: shipmentId });

        if (!order) {
            console.warn(`Commande introuvable pour shipmentId: ${shipmentId}`);
            return NextResponse.json({ success: true, message: "Commande introuvable" });
        }

        const updateData: any = {};

        // Mapping des statuts Boxtal vers nos statuts internes
        if (status === "PENDING" && order.status === "preparing") {
            updateData.status = "ready";
            updateData.readyAt = new Date();
            if (trackingNumber) {
                updateData.trackingNumber = trackingNumber;
            }
            // Nettoyage des images supplémentaires
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
        } else if (status === "SHIPPED" || status === "IN_TRANSIT") {
            updateData.status = "in_transit";
            if (trackingNumber && !order.trackingNumber) {
                updateData.trackingNumber = trackingNumber;
            }
        } else if (status === "OUT_FOR_DELIVERY") {
            updateData.status = "out_for_delivery";
        } else if (status === "DELIVERED") {
            updateData.status = "delivered";
            if (!order.deliveredAt) {
                updateData.deliveredAt = new Date();
            }
        } else if (status === "CANCELLED") {
            updateData.status = "cancelled";
        }

        await ordersCollection.updateOne(
            { _id: new ObjectId(order._id) },
            { $set: updateData }
        );

        await notifyClients({
            type: "order_status_updated",
            data: {
                orderId: order._id.toString(),
                status: updateData.status || order.status
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erreur webhook Boxtal:", error);
        return NextResponse.json(
            { error: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}
