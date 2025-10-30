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

        let query: any = {
            userEmail: session.user.email,
            status: { $in: statuses }
        };

        // Si on demande les commandes "delivered" pour la section Commandes
        // On filtre celles livrées depuis moins de 24h
        if (statuses.includes('delivered') && statuses.includes('paid')) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query = {
                userEmail: session.user.email,
                $or: [
                    { status: { $in: statuses.filter(s => s !== 'delivered') } },
                    {
                        status: 'delivered',
                        deliveredAt: { $gte: twentyFourHoursAgo }
                    }
                ]
            };
        }
        // Si on demande l'historique, on prend les delivered de plus de 24h + cancelled + returned
        else if (statuses.includes('delivered') && statuses.includes('cancelled')) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query = {
                userEmail: session.user.email,
                $or: [
                    { status: { $in: ['cancelled', 'returned'] } },
                    {
                        status: 'delivered',
                        deliveredAt: { $lt: twentyFourHoursAgo }
                    },
                    {
                        status: 'delivered',
                        deliveredAt: { $exists: false }
                    }
                ]
            };
        }

        const orders = await ordersCollection
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json({ orders });
    } catch (error: any) {
        console.error("Erreur récupération commandes:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération des commandes" },
            { status: 500 }
        );
    }
}
