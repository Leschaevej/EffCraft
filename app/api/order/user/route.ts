import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise from "../../../lib/mongodb";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Non authentifié" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const statusesParam = searchParams.get('statuses') || 'paid';
        const statuses = statusesParam.split(',');

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");

        // Simple query: récupérer toutes les commandes avec les statuts demandés
        const query: any = {
            userEmail: session.user.email,
            "order.status": { $in: statuses }
        };

        const orders = await ordersCollection
            .find(query)
            .sort({ "order.createdAt": -1 })
            .toArray();

        // Nettoyer shippingData des commandes livrées depuis plus de 14 jours
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const toClean = orders
            .filter(o =>
                o.order?.status === "delivered" &&
                o.order?.deliveredAt &&
                new Date(o.order.deliveredAt) < fourteenDaysAgo &&
                o.shippingData
            )
            .map(o => o._id);

        if (toClean.length > 0) {
            ordersCollection.updateMany(
                { _id: { $in: toClean } },
                { $unset: { shippingData: "" } }
            ).catch(err => console.error("Erreur nettoyage shippingData:", err));
        }

        return NextResponse.json({ orders });
    } catch (error: any) {
        console.error("Erreur récupération commandes:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération des commandes" },
            { status: 500 }
        );
    }
}
