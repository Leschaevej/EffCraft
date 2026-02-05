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
        // Récupérer le body brut pour la vérification de signature
        const rawBody = await req.text();
        console.log("🔔 Body reçu:", rawBody);
        const body = JSON.parse(rawBody);
        console.log("🔔 Body parsé:", JSON.stringify(body, null, 2));

        // Vérifier la signature
        const signature = req.headers.get("x-bxt-signature");
        const webhookSecret = process.env.BOXTAL_WEBHOOK_TOKEN;

        if (!webhookSecret) {
            console.error("❌ BOXTAL_WEBHOOK_TOKEN non configuré dans .env");
            return NextResponse.json(
                { error: "Configuration manquante" },
                { status: 500 }
            );
        }

        // Vérifier si c'est une simulation depuis le backoffice
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

        // Extraire les données - la structure peut varier selon l'événement
        let shipmentId = body.shipmentId || body.shippingOrderId;
        let status = body.status;
        let trackingNumber = body.trackingNumber;
        let eventType = body.eventType || body.type;

        // Si c'est une simulation depuis le backoffice
        if (isSimulation) {
            status = body.event; // READY_TO_SHIP, PICKED_UP, etc.
            shipmentId = body.shipment.id;
            trackingNumber = body.shipment.trackingNumber;
            eventType = "TRACKING_CHANGED";
            console.log("🧪 Données simulation:", { status, shipmentId, trackingNumber });
        }
        // Si c'est un événement TRACKING_CHANGED avec payload.trackings
        else if (body.payload && body.payload.trackings && Array.isArray(body.payload.trackings) && body.payload.trackings.length > 0) {
            const tracking = body.payload.trackings[0];
            status = tracking.status;
            trackingNumber = tracking.trackingNumber;
            console.log("📦 TRACKING_CHANGED détecté:", { status, trackingNumber, shipmentId });
        }
        // Si c'est un événement TRACKING_CHANGED, les données peuvent être dans content
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
            // Si c'est un événement de test, on retourne success au lieu d'une erreur
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

        // Toujours stocker le statut Boxtal brut pour le debug
        updateData["shippingData.boxtalStatus"] = status;
        updateData["shippingData.boxtalLastUpdate"] = new Date();

        // Si c'est un retour, on met à jour boxtalStatus au lieu de order.status
        const isReturn = order.order.status === "return_requested" || order.order.status?.startsWith("return_");

        if (isReturn) {
            // Pour les retours : on met à jour boxtalStatus ET order.status pour l'affichage
            // Mapping des VRAIS statuts Boxtal vers des statuts de retour
            if (status === "ANNOUNCED" || status === "PENDING" || status === "READY_TO_SHIP") {
                updateData["order.status"] = "return_requested";
            } else if (status === "AT_PICKUP_LOCATION" || status === "PICKED_UP") {
                updateData["order.status"] = "return_preparing";
            } else if (status === "IN_TRANSIT") {
                updateData["order.status"] = "return_in_transit";
            } else if (status === "OUT_FOR_DELIVERY") {
                updateData["order.status"] = "return_out_for_delivery";
            } else if (status === "DELIVERED" || status === "AVAILABLE_FOR_WITHDRAWAL") {
                updateData["order.status"] = "return_delivered";
            }

            console.log(`🔄 Retour : mise à jour boxtalStatus à ${status}, order.status à ${updateData["order.status"]}`);
        } else {
            // Pour les envois normaux : on met à jour order.status
            // Mapping des VRAIS statuts Boxtal vers nos statuts internes
            // Statuts Boxtal réels: ANNOUNCED, AT_PICKUP_LOCATION, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, AVAILABLE_FOR_WITHDRAWAL, RETURNED

            console.log(`📦 Statut actuel de la commande: ${order.order.status}, Nouveau statut Boxtal: ${status}`);

            // ANNOUNCED = Envoi préparé / annoncé au transporteur
            if (status === "ANNOUNCED" || status === "PENDING" || status === "READY_TO_SHIP") {
                if (["paid"].includes(order.order.status)) {
                    updateData["order.status"] = "preparing";
                    updateData["order.preparingAt"] = new Date();
                }
                if (trackingNumber) {
                    updateData["shippingData.trackingNumber"] = trackingNumber;
                }
            }
            // AT_PICKUP_LOCATION = En attente de collecte / PICKED_UP = Récupéré par le transporteur
            else if (status === "AT_PICKUP_LOCATION" || status === "PICKED_UP") {
                if (["paid", "preparing"].includes(order.order.status)) {
                    updateData["order.status"] = "ready";
                    updateData["order.readyAt"] = new Date();
                }
                if (trackingNumber) {
                    updateData["shippingData.trackingNumber"] = trackingNumber;
                }
                // Nettoyage des images supplémentaires (seulement si on passe à ready)
                if (updateData["order.status"] === "ready" && order.products && order.products.length > 0) {
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
            // IN_TRANSIT = En transit
            else if (status === "SHIPPED" || status === "IN_TRANSIT") {
                if (["paid", "preparing", "ready"].includes(order.order.status)) {
                    updateData["order.status"] = "in_transit";
                }
                if (trackingNumber && !order.shippingData?.trackingNumber) {
                    updateData["shippingData.trackingNumber"] = trackingNumber;
                }
            }
            // OUT_FOR_DELIVERY = En cours de livraison
            else if (status === "OUT_FOR_DELIVERY") {
                if (["paid", "preparing", "ready", "in_transit"].includes(order.order.status)) {
                    updateData["order.status"] = "out_for_delivery";
                }
            }
            // DELIVERED = Livré / AVAILABLE_FOR_WITHDRAWAL = Disponible en point relais
            else if (status === "DELIVERED" || status === "AVAILABLE_FOR_WITHDRAWAL") {
                if (order.order.status !== "delivered") {
                    updateData["order.status"] = "delivered";
                    updateData["order.deliveredAt"] = new Date();
                }
            }
            // RETURNED = Retourné à l'expéditeur / CANCELLED = Annulé
            else if (status === "CANCELLED" || status === "RETURNED") {
                updateData["order.status"] = "cancelled";
            }

            // Log si aucune mise à jour de statut n'a été effectuée (hors boxtalStatus/boxtalLastUpdate)
            const hasStatusUpdate = updateData["order.status"] !== undefined;
            if (!hasStatusUpdate) {
                console.log(`⚠️ Pas de changement de statut commande - statut Boxtal ${status} reçu, commande déjà en ${order.order.status}`);
            } else {
                console.log(`✅ Mise à jour prévue:`, JSON.stringify(updateData, null, 2));
            }
        }

        await ordersCollection.updateOne(
            { _id: new ObjectId(order._id) },
            { $set: updateData }
        );

        await notifyClients({
            type: "order_status_updated",
            data: {
                orderId: order._id.toString(),
                status: updateData["order.status"] || order.order.status,
                boxtalStatus: updateData["shippingData.boxtalStatus"]
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
