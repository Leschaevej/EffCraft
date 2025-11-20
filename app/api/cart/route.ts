import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Product from "../../lib/models/Product";
import User from "../../lib/models/User";

declare global {
    var _sseClients: Set<ReadableStreamDefaultController> | undefined;
}
const getClients = () => {
    if (!globalThis._sseClients) {
        globalThis._sseClients = new Set<ReadableStreamDefaultController>();
    }
    return globalThis._sseClients;
};
function addClient(controller: ReadableStreamDefaultController) {
    const clients = getClients();
    clients.add(controller);
}
function removeClient(controller: ReadableStreamDefaultController) {
    const clients = getClients();
    clients.delete(controller);
}
export function notifyClients(event: { type: string; data: Record<string, unknown> }) {
    const clients = getClients();
    const message = `data: ${JSON.stringify(event)}\n\n`;
    if (clients.size === 0) {
        return;
    }
    clients.forEach(controller => {
        try {
            controller.enqueue(new TextEncoder().encode(message));
        } catch (error) {
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
let cleanupTimeout: NodeJS.Timeout | null = null;
let nextCleanupTime: Date | null = null;
export async function scheduleNextCleanup() {
    if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
        cleanupTimeout = null;
    }
    try {
        await dbConnect();
        const nextExpiring = await User.findOne({
            cartExpiresAt: { $exists: true, $gt: new Date() },
            cart: { $exists: true, $ne: [] }
        })
        .sort({ cartExpiresAt: 1 })
        .select('cartExpiresAt');
        if (!nextExpiring || !nextExpiring.cartExpiresAt) {
            nextCleanupTime = null;
            return;
        }
        const expiryDate = nextExpiring.cartExpiresAt;
        nextCleanupTime = expiryDate;
        const now = new Date();
        const delay = Math.max(0, expiryDate.getTime() - now.getTime() + 1000);
        cleanupTimeout = setTimeout(async () => {
            await handleCleanup(false);
            await scheduleNextCleanup();
        }, delay);
    } catch (error) {
        console.error("Erreur lors de la planification du nettoyage:", error);
        cleanupTimeout = setTimeout(() => scheduleNextCleanup(), 60000);
    }
}
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "cleanup") {
        return handleCleanup();
    }
    if (!cleanupTimeout) {
        scheduleNextCleanup();
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
async function handleCleanup(returnResponse: boolean = true) {
    try {
        await dbConnect();
        const now = new Date();
        const expiredUsers = await User.find({
            cartExpiresAt: { $exists: true, $lt: now },
            cart: { $exists: true, $ne: [] }
        });
        if (expiredUsers.length === 0) {
            if (returnResponse) {
                return NextResponse.json({
                    message: "Aucun panier expiré",
                    cleaned: 0
                });
            }
            return;
        }
        let totalProductsFreed = 0;
        for (const user of expiredUsers) {
            if (user.cart.length > 0) {
                const userCartProductIds = user.cart.map((item: any) => item.productId);
                totalProductsFreed += userCartProductIds.length;
                await Product.updateMany(
                    { _id: { $in: userCartProductIds } },
                    {
                        $set: { status: "available" },
                        $unset: { reservedBy: "" }
                    }
                );
                user.cart = [];
                user.cartExpiresAt = undefined;
                await user.save();
                userCartProductIds.forEach((productId: any) => {
                    notifyClients({
                        type: "product_available",
                        data: { productId: productId.toString() }
                    });
                });
            }
        }
        if (returnResponse) {
            return NextResponse.json({
                message: "Paniers expirés nettoyés",
                usersAffected: expiredUsers.length,
                productsFreed: totalProductsFreed
            });
        }
    } catch (error) {
        if (returnResponse) {
            return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
        }
    }
}
export async function POST() {
    return handleCleanup();
}