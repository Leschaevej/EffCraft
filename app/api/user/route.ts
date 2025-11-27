import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import User from "../../lib/models/User";
import Product from "../../lib/models/Product";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";
import { notifyClients } from "../../lib/pusher-server";
import { scheduleNextCleanup } from "../cart/route";

interface CartItem {
    productId: mongoose.Types.ObjectId;
    addedAt: Date;
}
async function dbConnect() {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!, {
            dbName: "effcraftdatabase"
        });
    }
}
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    await dbConnect();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
        return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    const type = request.nextUrl.searchParams.get("type");
    if (type === "me") {
        return NextResponse.json({
            userId: user._id.toString(),
            email: user.email,
            name: user.name
        });
    }
    const client = await import("../../lib/mongodb").then((mod) => mod.default);
    const db = client.db("effcraftdatabase");
    if (type === "cart") {
        const productIds = user.cart.map((item: CartItem) => new ObjectId(item.productId));
        const products = await db
        .collection("products")
        .find({ _id: { $in: productIds } })
        .toArray();
        const cartDetailed = user.cart
        .map((cartItem: CartItem) => {
            const product = products.find(
            (p) => p._id.toString() === cartItem.productId.toString()
            );
            if (!product) return null;
            return {
            _id: product._id.toString(),
            name: product.name,
            price: product.price,
            images: product.images,
            addedAt: cartItem.addedAt,
            };
        })
        .filter(Boolean);
        return NextResponse.json({
            cart: cartDetailed,
            cartExpiresAt: user.cartExpiresAt
        });
    }
    if (type === "favorites") {
        const favoritesIds = user.favorites.map((id: mongoose.Types.ObjectId) => new ObjectId(id));
        const favorites = await db
        .collection("products")
        .find({ _id: { $in: favoritesIds } })
        .toArray();
        const favoritesWithStringId = favorites.map((f) => ({
            ...f,
            _id: f._id.toString(),
        }));
        return NextResponse.json({ favorites: favoritesWithStringId });
    }
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
}
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    await dbConnect();
    const { action, productId } = await request.json();
    if (!productId || !ObjectId.isValid(productId)) {
        return NextResponse.json({ error: "ID produit invalide" }, { status: 400 });
    }
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
        return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    if (action === "addCart") {
        const product = await Product.findById(productId);
        if (!product) {
            return NextResponse.json({ error: "Produit non trouvé" }, { status: 404 });
        }
        if (product.status === "reserved" && product.reservedBy?.toString() !== user._id.toString()) {
            return NextResponse.json({
                error: "Ce produit est déjà réservé par un autre utilisateur",
                reservedUntil: product.reservedUntil
            }, { status: 409 });
        }
        const exists = user.cart.some(
            (item: CartItem) => item.productId.toString() === productId
        );
        if (!exists) {
            const now = new Date();
            let cartExpiresAt: Date;
            if (user.cart.length === 0 || !user.cartExpiresAt) {
                cartExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
                user.cartExpiresAt = cartExpiresAt;
            } else {
                cartExpiresAt = user.cartExpiresAt;
            }
            user.cart.push({
                productId: new mongoose.Types.ObjectId(productId),
                addedAt: now,
            });
            product.status = "reserved";
            product.reservedBy = user._id as mongoose.Types.ObjectId;
            await product.save();
            await user.save();
            notifyClients({
                type: "product_reserved",
                data: {
                    productId: productId,
                    cartExpiresAt: cartExpiresAt.toISOString()
                }
            });
            scheduleNextCleanup();
            return NextResponse.json({
                success: true,
                cart: user.cart,
                expiresAt: cartExpiresAt.toISOString()
            });
        }
    } else if (action === "add_favorite") {
        const alreadyFav = user.favorites.some(
        (id: mongoose.Types.ObjectId) => id.toString() === productId
        );
        if (!alreadyFav) {
        user.favorites.push(new mongoose.Types.ObjectId(productId));
        }
    } else {
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
    await user.save();
    return NextResponse.json({ favorites: user.favorites, cart: user.cart });
}
export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    await dbConnect();
    const { action, productId } = await request.json();
    if (!productId || !ObjectId.isValid(productId)) {
        return NextResponse.json({ error: "ID produit invalide" }, { status: 400 });
    }
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
        return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    if (action === "remove_cart") {
        const product = await Product.findById(productId);
        if (product && product.reservedBy?.toString() === user._id.toString()) {
            product.status = "available";
            product.reservedBy = undefined;
            product.reservedUntil = undefined;
            await product.save();
        }
        user.cart = user.cart.filter(
            (item: CartItem) => item.productId.toString() !== productId
        );
        if (user.cart.length === 0) {
            user.cartExpiresAt = undefined;
        }
        notifyClients({
            type: "product_available",
            data: { productId: productId }
        });
    } else if (action === "remove_favorite") {
        user.favorites = user.favorites.filter(
        (id: mongoose.Types.ObjectId) => id.toString() !== productId
        );
    } else {
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
    await user.save();
    return NextResponse.json({ favorites: user.favorites, cart: user.cart });
}