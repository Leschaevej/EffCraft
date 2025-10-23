import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Product from "../../lib/models/Product";
import User from "../../lib/models/User";

// ============================================
// GESTION SSE (Server-Sent Events)
// ============================================

// Store global pour les connexions SSE
const clients = new Set<ReadableStreamDefaultController>();

function addClient(controller: ReadableStreamDefaultController) {
    clients.add(controller);
    console.log(`Client ajouté. Total: ${clients.size}`);
}

function removeClient(controller: ReadableStreamDefaultController) {
    clients.delete(controller);
    console.log(`Client retiré. Total: ${clients.size}`);
}

export function notifyClients(event: { type: string; data: Record<string, unknown> }) {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    console.log(`Notification envoyée à ${clients.size} clients:`, event);

    clients.forEach(controller => {
        try {
            controller.enqueue(new TextEncoder().encode(message));
        } catch (error) {
            console.error("Erreur envoi SSE:", error);
            clients.delete(controller);
        }
    });
}

// ============================================
// CONNEXION DB
// ============================================

async function dbConnect() {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!, {
            dbName: "effcraftdatabase"
        });
    }
}

// ============================================
// ROUTE GET: Stream SSE
// ============================================

export async function GET(request: NextRequest) {
    // Si c'est une demande de cleanup
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "cleanup") {
        return handleCleanup();
    }

    // Sinon, c'est une connexion SSE
    const stream = new ReadableStream({
        start(controller) {
            // Ajouter le client à la liste
            addClient(controller);

            // Envoyer un message initial
            const welcome = `data: ${JSON.stringify({ type: "connected", message: "Connexion établie" })}\n\n`;
            controller.enqueue(new TextEncoder().encode(welcome));

            // Heartbeat toutes les 30 secondes pour garder la connexion active
            const heartbeat = setInterval(() => {
                try {
                    const ping = `data: ${JSON.stringify({ type: "ping" })}\n\n`;
                    controller.enqueue(new TextEncoder().encode(ping));
                } catch {
                    clearInterval(heartbeat);
                    removeClient(controller);
                }
            }, 30000);

            // Nettoyer quand le client se déconnecte
            request.signal.addEventListener("abort", () => {
                clearInterval(heartbeat);
                removeClient(controller);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}

// ============================================
// ROUTE POST: Nettoyage des réservations expirées
// ============================================

async function handleCleanup() {
    try {
        await dbConnect();

        const now = new Date();

        // Trouver tous les produits réservés dont la date d'expiration est dépassée
        const expiredProducts = await Product.find({
            status: "reserved",
            reservedUntil: { $lt: now }
        });

        if (expiredProducts.length === 0) {
            return NextResponse.json({
                message: "Aucune réservation expirée",
                cleaned: 0
            });
        }

        // Récupérer les IDs des utilisateurs concernés et les IDs de produits
        const userIds = expiredProducts
            .filter(p => p.reservedBy)
            .map(p => p.reservedBy);
        const productIds = expiredProducts.map(p => p._id);

        // Libérer les produits
        await Product.updateMany(
            { _id: { $in: productIds } },
            {
                $set: { status: "available" },
                $unset: { reservedBy: "", reservedUntil: "" }
            }
        );

        // Retirer les produits des paniers des utilisateurs
        await User.updateMany(
            { _id: { $in: userIds } },
            {
                $pull: {
                    cart: { productId: { $in: productIds } }
                }
            }
        );

        // Notifier tous les clients que les produits sont à nouveau disponibles
        productIds.forEach(productId => {
            notifyClients({
                type: "product_available",
                data: { productId: productId.toString() }
            });
        });

        return NextResponse.json({
            message: "Réservations expirées nettoyées",
            cleaned: expiredProducts.length,
            productIds: productIds.map(id => id.toString())
        });
    } catch (error) {
        console.error("Erreur nettoyage réservations:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

export async function POST() {
    return handleCleanup();
}
