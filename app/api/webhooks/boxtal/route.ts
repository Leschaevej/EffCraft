import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";
import cloudinary from "../../../lib/cloudinary";
import { notifyClients } from "../../cart/route";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("📦 Webhook Boxtal reçu:", JSON.stringify(body, null, 2));
        const { shipmentId, status, trackingNumber } = body;
        if (!shipmentId) {
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
            console.warn("⚠️ Commande introuvable pour shipmentId:", shipmentId);
            return NextResponse.json({ success: true, message: "Commande introuvable" });
        }
        console.log("📋 Commande trouvée:", order._id, "- Statut actuel:", order.status);
        const updateData: any = {
            boxtalStatus: status
        };
        if (status === "PENDING" && order.status === "preparing") {
            console.log("🚚 Colis remis au transporteur - Déclenchement du nettoyage");
            updateData.status = "ready";
            updateData.readyAt = new Date();
            if (trackingNumber) {
                updateData.trackingNumber = trackingNumber;
            }
            if (order.products && order.products.length > 0) {
                const imagesToDelete: string[] = [];
                order.products.forEach((p: any) => {
                    if (p.images && p.images.length > 1) {
                        imagesToDelete.push(...p.images.slice(1));
                    }
                });
                if (imagesToDelete.length > 0) {
                    console.log("🗑️ Suppression de", imagesToDelete.length, "images de Cloudinary");
                    for (const imageUrl of imagesToDelete) {
                        try {
                            const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
                            if (match && match[1]) {
                                const publicId = match[1];
                                await cloudinary.uploader.destroy(publicId);
                                console.log("✅ Image supprimée:", publicId);
                            }
                        } catch (error) {
                            console.error("❌ Erreur suppression image Cloudinary:", error);
                        }
                    }
                }
                const cleanedProducts = order.products.map((p: any) => ({
                    name: p.name,
                    price: p.price,
                    images: p.images && p.images.length > 0 ? [p.images[0]] : []
                }));

                updateData.products = cleanedProducts;
                console.log("✅ Données produit nettoyées automatiquement");
            }
        } else if (status === "IN_TRANSIT") {
            updateData.status = "in_transit";
        } else if (status === "OUT_FOR_DELIVERY") {
            updateData.status = "out_for_delivery";
        } else if (status === "DELIVERED") {
            updateData.status = "delivered";
            if (!order.deliveredAt) {
                updateData.deliveredAt = new Date();
            }
        }
        await ordersCollection.updateOne(
            { _id: new ObjectId(order._id) },
            { $set: updateData }
        );
        console.log("✅ Commande mise à jour:", order._id, "- Nouveau statut:", updateData.status || order.status);
        notifyClients({
            type: "order_status_updated",
            data: {
                orderId: order._id.toString(),
                status: updateData.status || order.status,
                boxtalStatus: updateData.boxtalStatus
            }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("❌ Erreur webhook Boxtal:", error);
        return NextResponse.json(
            { error: error.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}