import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";
import cloudinary from "../../lib/cloudinary";
import { notifyClients } from "../cart/route";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || session.user.role !== "admin") {
            return NextResponse.json(
                { error: "Non autorisé" },
                { status: 403 }
            );
        }
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'paid';

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");
        const orders = await ordersCollection
            .find({ status })
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

export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || session.user.role !== "admin") {
            return NextResponse.json(
                { error: "Non autorisé" },
                { status: 403 }
            );
        }

        const { orderId, action } = await req.json();
        if (!orderId || !action) {
            return NextResponse.json(
                { error: "Paramètres manquants" },
                { status: 400 }
            );
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");

        let updateData: any = {};

        switch (action) {
            case "cancel":
                updateData = {
                    status: "cancelled",
                    cancelledAt: new Date()
                };
                break;
            case "return":
                updateData = {
                    status: "returned",
                    returnedAt: new Date()
                };
                break;
            default:
                return NextResponse.json(
                    { error: "Action invalide" },
                    { status: 400 }
                );
        }

        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: updateData }
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erreur mise à jour commande:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la mise à jour" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Non authentifié" },
                { status: 401 }
            );
        }
        const { paymentIntentId, shippingData, billingData, shippingMethod, products } = await req.json();
        if (!paymentIntentId) {
            return NextResponse.json(
                { error: "Payment Intent manquant" },
                { status: 400 }
            );
        }
        if (!products || products.length === 0) {
            return NextResponse.json(
                { error: "Aucun produit" },
                { status: 400 }
            );
        }
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const usersCollection = db.collection("users");
        const productsCollection = db.collection("products");
        const productIds = products.map((p: any) => new ObjectId(p._id));
        const imagesToDelete: string[] = [];
        products.forEach((p: any) => {
            if (p.images && p.images.length > 1) {
                imagesToDelete.push(...p.images.slice(1));
            }
        });
        if (imagesToDelete.length > 0) {
            for (const imageUrl of imagesToDelete) {
                try {
                    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
                    if (match && match[1]) {
                        const publicId = match[1];
                        await cloudinary.uploader.destroy(publicId);
                    }
                } catch (error) {
                    console.error("Erreur suppression image Cloudinary:", error);
                }
            }
        }
        const productsForOrder = products.map((p: any) => ({
            ...p,
            images: p.images && p.images.length > 0 ? [p.images[0]] : []
        }));
        const totalPrice = products.reduce((acc: number, product: any) => acc + product.price, 0);
        await productsCollection.deleteMany({
            _id: { $in: productIds }
        });
        productIds.forEach((productId: ObjectId) => {
            notifyClients({
                type: "product_deleted",
                data: { productId: productId.toString() }
            });
        });
        await usersCollection.updateMany(
            { favorites: { $in: productIds } },
            { $pull: { favorites: { $in: productIds } } } as any
        );
        await usersCollection.updateMany(
            { "cart.productId": { $in: productIds } },
            { $pull: { cart: { productId: { $in: productIds } } } } as any
        );
        await usersCollection.updateOne(
            { email: session.user.email },
            {
                $set: { cart: [] },
                $unset: { cartExpiresAt: "" }
            }
        );
        const ordersCollection = db.collection("orders");
        const order = {
            userEmail: session.user.email,
            products: productsForOrder,
            totalPrice: totalPrice,
            shippingData: shippingData,
            billingData: billingData,
            shippingMethod: shippingMethod,
            paymentIntentId: paymentIntentId,
            status: "paid",
            createdAt: new Date(),
        };
        const result = await ordersCollection.insertOne(order);

        return NextResponse.json({
            success: true,
            orderId: result.insertedId,
            products: products,
        });
    } catch (error: any) {
        console.error("Erreur création commande:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la création de la commande" },
            { status: 500 }
        );
    }
}