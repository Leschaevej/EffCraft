import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Product from "../../lib/models/Product";
import User from "../../lib/models/User";

const clients = new Set<ReadableStreamDefaultController>();
function addClient(controller: ReadableStreamDefaultController) {
    clients.add(controller);
}
function removeClient(controller: ReadableStreamDefaultController) {
    clients.delete(controller);
}
export function notifyClients(event: { type: string; data: Record<string, unknown> }) {
    const message = `data: ${JSON.stringify(event)}\n\n`;

    clients.forEach(controller => {
        try {
            controller.enqueue(new TextEncoder().encode(message));
        } catch (error) {
            console.error("Erreur envoi SSE:", error);
            clients.delete(controller);
        }
    });
}
async function dbConnect() {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!, {
            dbName: "effcraftdatabase"
        });
    }
}
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "cleanup") {
        return handleCleanup();
    }
    const stream = new ReadableStream({
        start(controller) {
            addClient(controller);
            const welcome = `data: ${JSON.stringify({ type: "connected", message: "Connexion établie" })}\n\n`;
            controller.enqueue(new TextEncoder().encode(welcome));
            const heartbeat = setInterval(() => {
                try {
                    const ping = `data: ${JSON.stringify({ type: "ping" })}\n\n`;
                    controller.enqueue(new TextEncoder().encode(ping));
                } catch {
                    clearInterval(heartbeat);
                    removeClient(controller);
                }
            }, 30000);
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
async function handleCleanup() {
    try {
        await dbConnect();
        const now = new Date();
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
        const userIds = expiredProducts
            .filter(p => p.reservedBy)
            .map(p => p.reservedBy);
        const productIds = expiredProducts.map(p => p._id);
        await Product.updateMany(
            { _id: { $in: productIds } },
            {
                $set: { status: "available" },
                $unset: { reservedBy: "", reservedUntil: "" }
            }
        );
        await User.updateMany(
            { _id: { $in: userIds } },
            {
                $pull: {
                    cart: { productId: { $in: productIds } }
                }
            }
        );
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