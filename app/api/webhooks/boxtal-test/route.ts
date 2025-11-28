import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";

const BOXTAL_WEBHOOK_TOKEN = process.env.BOXTAL_WEBHOOK_TOKEN || "";

export async function POST(req: NextRequest) {
    // Vérifier le token dans l'URL
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token || token !== BOXTAL_WEBHOOK_TOKEN) {
        console.error("❌ Token invalide ou manquant");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Récupérer et parser le body
    const bodyText = await req.text();
    let webhookData;

    try {
        webhookData = JSON.parse(bodyText);
    } catch (e) {
        console.error("❌ Body non-JSON:", bodyText);
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");

        // Identifier le type d'événement
        const eventType = webhookData.eventType || webhookData.type;
        const shippingOrderId = webhookData.shippingOrderId || webhookData.id;

        if (!shippingOrderId) {
            console.error("❌ Pas de shippingOrderId dans le webhook");
            return NextResponse.json({ error: "Missing shippingOrderId" }, { status: 400 });
        }

        // Trouver la commande correspondante
        const order = await ordersCollection.findOne({
            boxtalShipmentId: shippingOrderId
        });

        if (!order) {
            console.warn(`⚠️ Aucune commande trouvée pour boxtalShipmentId: ${shippingOrderId}`);
            return NextResponse.json({
                success: true,
                message: "Order not found but acknowledged"
            }, { status: 200 });
        }

        // Gérer selon le type d'événement
        if (eventType === 'DOCUMENT_CREATED' || webhookData.documents) {
            // Document d'expédition créé
            const documents = webhookData.documents || [];
            const labelDoc = documents.find((doc: any) => doc.type === 'LABEL');

            if (labelDoc && labelDoc.url) {
                await ordersCollection.updateOne(
                    { _id: order._id },
                    {
                        $set: {
                            shippingLabel: labelDoc.url,
                            shippingLabelUpdatedAt: new Date()
                        }
                    }
                );
            }
        }

        if (eventType === 'TRACKING_CHANGED' || webhookData.tracking) {
            // Suivi modifié
            const tracking = webhookData.tracking || webhookData;
            const trackingStatus = tracking.status;
            const trackingHistory = tracking.history || [];

            const updateData: any = {
                trackingStatus: trackingStatus,
                trackingHistory: trackingHistory,
                trackingUpdatedAt: new Date()
            };

            // Mettre à jour le statut de la commande selon le statut de suivi
            if (trackingStatus === 'DELIVERED') {
                updateData.status = 'delivered';
                updateData.deliveredAt = new Date();
            } else if (trackingStatus === 'IN_TRANSIT') {
                updateData.status = 'shipped';
            } else if (trackingStatus === 'PENDING_PICKUP') {
                updateData.status = 'preparing';
            }

            await ordersCollection.updateOne(
                { _id: order._id },
                { $set: updateData }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Webhook processed successfully",
            orderId: order._id.toString()
        }, { status: 200 });

    } catch (error: any) {
        console.error("❌ Erreur traitement webhook:", error);
        return NextResponse.json({
            error: "Internal server error",
            details: error.message
        }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return NextResponse.json({
        success: true,
        message: "Webhook endpoint ready",
        hasSecret: !!BOXTAL_WEBHOOK_TOKEN
    }, { status: 200 });
}

export async function HEAD(req: NextRequest) {
    return new NextResponse(null, { status: 200 });
}

export async function PUT(req: NextRequest) {
    return NextResponse.json({ success: true }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
    return NextResponse.json({ success: true }, { status: 200 });
}
