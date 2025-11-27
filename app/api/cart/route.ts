import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Product from "../../lib/models/Product";
import User from "../../lib/models/User";
import { notifyClients } from "../../lib/pusher-server";

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

    return NextResponse.json({ message: "Use Pusher for real-time updates" });
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

                for (const productId of userCartProductIds) {
                    await notifyClients({
                        type: "product_available",
                        data: { productId: productId.toString() }
                    });
                }
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

export { notifyClients };
