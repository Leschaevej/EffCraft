import { NextResponse } from "next/server";
import mongoose from "mongoose";
import clientPromise from "../../../lib/mongodb";
import User from "../../../lib/models/User";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { ObjectId } from "mongodb";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    try {
        const client = await clientPromise;
        const db = client.db();
        if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!);
        }
        const user = await User.findOne({ email: session.user.email });
        if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
        const favoritesIds = user.favorites.map((id) => new ObjectId(id));
        const favorites = await db
        .collection("products")
        .find({ _id: { $in: favoritesIds } })
        .toArray();
        return NextResponse.json({ favorites });
    } catch (error) {
        console.error("Erreur GET /favorites:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const { productId } = await request.json();
    try {
        const client = await clientPromise;
        await client.db();
        if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!);
        }
        const user = await User.findOne({ email: session.user.email });
        if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
        if (!user.favorites.includes(productId)) {
        user.favorites.push(productId);
        await user.save();
        }
        return NextResponse.json({ favorites: user.favorites });
    } catch (error) {
        console.error("Erreur POST /favorites:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const { productId } = await request.json();
    try {
        const client = await clientPromise;
        await client.db();
        if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!);
        }
        const user = await User.findOne({ email: session.user.email });
        if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
        user.favorites = user.favorites.filter((id) => id !== productId);
        await user.save();
        return NextResponse.json({ favorites: user.favorites });
    } catch (error) {
        console.error("Erreur DELETE /favorites:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}