import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise from "../../../lib/mongodb";
import cloudinary from "../../../lib/cloudinary";
import { ObjectId } from "mongodb";

// Statuts de retour actifs → apparaissent dans "pending"
const RETURN_PENDING_STATUSES = ["requested", "preparing", "in_transit", "delivered"];
// Statuts de retour terminés → apparaissent dans "history"
const RETURN_HISTORY_STATUSES = ["refunded", "rejected"];

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

        // Déduire si on est en mode "pending" ou "history" selon les statuts demandés
        const isPendingView = statuses.includes("paid");

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");
        const returnsCollection = db.collection("returns");

        // Statuts purs orders à chercher (sans les statuts return_* qui viennent maintenant de returns)
        const orderStatuses = statuses.filter(s => !s.startsWith("return_"));

        const query: any = {
            userEmail: session.user.email,
            "order.status": { $in: orderStatuses }
        };

        const orders = await ordersCollection
            .find(query)
            .sort({ "order.createdAt": -1 })
            .toArray();

        // Supprimer les commandes terminées depuis plus de 14 jours
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const toDelete = orders.filter(o => {
            if (o.order?.status === "delivered" && o.order?.deliveredAt) {
                return new Date(o.order.deliveredAt) < fourteenDaysAgo;
            }
            if (o.order?.status === "cancelled" && o.order?.cancelledAt) {
                return new Date(o.order.cancelledAt) < fourteenDaysAgo;
            }
            return false;
        });

        if (toDelete.length > 0) {
            const deleteTask = async () => {
                for (const order of toDelete) {
                    for (const product of (order.products || [])) {
                        if (product.image) {
                            try {
                                const match = product.image.match(/effcraft\/products\/[^.]+/);
                                if (match) await cloudinary.uploader.destroy(match[0]);
                            } catch (e) {
                                console.error("Erreur suppression image produit Cloudinary:", e);
                            }
                        }
                    }
                }
                await ordersCollection.deleteMany({ _id: { $in: toDelete.map(o => o._id) } });
            };
            deleteTask().catch(err => console.error("Erreur suppression commandes expirées:", err));
        }

        // Supprimer les retours terminés depuis plus de 14 jours (refunded ou rejected)
        const expiredReturns = await returnsCollection.find({
            userEmail: session.user.email,
            status: { $in: ["refunded", "rejected"] },
            $or: [
                { refundedAt: { $lt: fourteenDaysAgo } },
                { rejectedAt: { $lt: fourteenDaysAgo } }
            ]
        }).toArray();
        if (expiredReturns.length > 0) {
            returnsCollection.deleteMany({ _id: { $in: expiredReturns.map(r => r._id) } })
                .catch(err => console.error("Erreur suppression retours expirés:", err));
        }

        // Exclure les commandes à supprimer de la liste finale
        const activeOrders = orders.filter(o => !toDelete.some(d => d._id.equals(o._id)));

        // Récupérer les retours du client
        const returnStatusFilter = isPendingView ? RETURN_PENDING_STATUSES : RETURN_HISTORY_STATUSES;
        const userReturns = await returnsCollection.find({
            userEmail: session.user.email,
            status: { $in: returnStatusFilter }
        }).sort({ requestedAt: -1 }).toArray();

        // Enrichir les commandes delivered avec leur retour éventuel
        // Mapper orderId → retour pour lookup rapide
        const returnByOrderId = new Map<string, any>();
        for (const ret of userReturns) {
            returnByOrderId.set(ret.orderId.toString(), ret);
        }

        // Pour les retours en cours (pending view), on a besoin des commandes originales delivered
        // pour afficher les infos commande (date, produits, etc.)
        let returnOrders: any[] = [];
        if (userReturns.length > 0) {
            const orderIds = userReturns.map(r => r.orderId);
            const relatedOrders = await ordersCollection.find({
                _id: { $in: orderIds }
            }).toArray();
            const relatedOrderMap = new Map(relatedOrders.map(o => [o._id.toString(), o]));

            // Construire des pseudo-commandes pour les retours (avec statut return_*)
            returnOrders = userReturns.map(ret => {
                const baseOrder = relatedOrderMap.get(ret.orderId.toString());
                if (!baseOrder) return null;
                const returnStatus = `return_${ret.status}`; // ex: return_requested, return_preparing...
                return {
                    ...baseOrder,
                    _id: baseOrder._id,
                    // On surcharge avec le statut du retour
                    order: {
                        ...baseOrder.order,
                        status: returnStatus,
                        returnRequestedAt: ret.requestedAt,
                        returnReason: ret.reason,
                        returnMessage: ret.message,
                        returnPhotos: ret.photos,
                        returnItems: ret.items,
                        returnTrackingNumber: ret.returnTrackingNumber,
                        returnRejectReason: ret.rejectReason,
                        refundedAt: ret.refundedAt,
                        refundAmount: ret.refundAmount,
                    },
                    // Identifiant du retour pour les actions
                    _returnId: ret._id.toString(),
                };
            }).filter(Boolean);
        }

        // Fusionner commandes normales + pseudo-commandes retour
        // Pour les commandes delivered qui ont un retour en cours : les exclure de activeOrders
        // (elles apparaissent déjà dans returnOrders)
        const orderIdsWithReturn = new Set(userReturns.map(r => r.orderId.toString()));
        const filteredOrders = activeOrders.filter(o => {
            if (o.order?.status === "delivered" && orderIdsWithReturn.has(o._id.toString())) {
                return false; // cette commande a un retour, elle apparaît via returnOrders
            }
            return true;
        });

        const allOrders = [...filteredOrders, ...returnOrders]
            .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());

        return NextResponse.json({ orders: allOrders });
    } catch (error: any) {
        console.error("Erreur récupération commandes:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la récupération des commandes" },
            { status: 500 }
        );
    }
}
