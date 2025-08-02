import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import User from "../../lib/models/User";
import { ObjectId } from "mongodb";
import { NextRequest } from "next/server";

interface CartItem {
    productId: mongoose.Types.ObjectId;
    addedAt: Date;
}
async function dbConnect() {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!);
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
    const client = await import("../../lib/mongodb").then((mod) => mod.default);
    const db = client.db();
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
        return NextResponse.json({ cart: cartDetailed });
    }
    if (type === "favorites") {
        const favoritesIds = user.favorites.map((id: mongoose.Types.ObjectId) => new ObjectId(id));
        const favorites = await db
        .collection("products")
        .find({ _id: { $in: favoritesIds } })
        .toArray();
        return NextResponse.json({ favorites });
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
        const exists = user.cart.some(
        (item: CartItem) => item.productId.toString() === productId
        );
        if (!exists) {
        const now = new Date();
        user.cart.push({
            productId: new mongoose.Types.ObjectId(productId),
            addedAt: now,
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
        user.cart = user.cart.filter(
        (item: CartItem) => item.productId.toString() !== productId
        );
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