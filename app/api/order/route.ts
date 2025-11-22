import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";
import cloudinary from "../../lib/cloudinary";
import { notifyClients } from "../cart/route";
import { stripe } from "../../lib/stripe-server";

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
        let query: any;
        if (status === 'history') {
            query = { status: { $in: ['delivered', 'cancelled', 'returned'] } };
        } else if (status === 'pending') {
            query = { status: { $nin: ['delivered', 'cancelled', 'returned'] } };
        } else {
            query = { status };
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
                const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
                if (!order) {
                    return NextResponse.json(
                        { error: "Commande introuvable" },
                        { status: 404 }
                    );
                }
                if (order.boxtalShipmentId) {
                    try {
                        const isProduction = process.env.BOXTAL_ENV === "production";
                        const apiKey = isProduction ? process.env.BOXTAL_V3_PROD_KEY : process.env.BOXTAL_V3_TEST_KEY;
                        const apiSecret = isProduction ? process.env.BOXTAL_V3_PROD_SECRET : process.env.BOXTAL_V3_TEST_SECRET;
                        if (apiKey && apiSecret) {
                            const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
                            const apiUrl = process.env.BOXTAL_ENV === "production"
                                ? "https://api.boxtal.com"
                                : "https://api.boxtal.build";
                            const deleteResponse = await fetch(
                                `${apiUrl}/shipping/v3.1/shipping-order/${order.boxtalShipmentId}`,
                                {
                                    method: "DELETE",
                                    headers: {
                                        "Authorization": `Basic ${authString}`,
                                        "Accept": "application/json"
                                    }
                                }
                            );
                            if (!deleteResponse.ok) {
                                const errorText = await deleteResponse.text();
                                console.error("Impossible d'annuler l'expédition Boxtal:", errorText);
                            }
                        }
                    } catch (boxtalError) {
                        console.error("Erreur lors de l'annulation Boxtal:", boxtalError);
                    }
                }
                try {
                    if (order.paymentIntentId) {
                        await stripe.refunds.create({
                            payment_intent: order.paymentIntentId,
                        });
                    }
                } catch (stripeError: any) {
                    console.error("Erreur remboursement Stripe:", stripeError);
                    return NextResponse.json(
                        { error: "Erreur lors du remboursement: " + stripeError.message },
                        { status: 500 }
                    );
                }
                const productsCollection = db.collection("products");
                if (order.products && order.products.length > 0) {
                    for (const product of order.products) {
                        const restoredProduct = {
                            name: product.name,
                            price: product.price,
                            description: product.description,
                            category: product.category,
                            images: product.images || [],
                            status: "available",
                            createdAt: new Date(),
                        };
                        const insertResult = await productsCollection.insertOne(restoredProduct);
                        notifyClients({
                            type: "product_created",
                            data: { productId: insertResult.insertedId.toString() }
                        });
                    }
                }
                await ordersCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            status: "cancelled",
                            cancelledAt: new Date(),
                            refundReason: "annulation de la commande"
                        },
                        $unset: {
                            shippingData: "",
                            billingData: "",
                            shippingMethod: "",
                            boxtalShipmentId: "",
                            boxtalStatus: "",
                            trackingNumber: "",
                            preparingAt: ""
                        }
                    }
                );
                notifyClients({
                    type: "order_status_updated",
                    data: {
                        orderId: orderId,
                        status: "cancelled"
                    }
                });
                return NextResponse.json({
                    success: true,
                    message: "Commande annulée, client remboursé et produits remis en ligne"
                });

            case "request-return":
                const returnRequestOrder = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
                if (!returnRequestOrder) {
                    return NextResponse.json(
                        { error: "Commande introuvable" },
                        { status: 404 }
                    );
                }
                await ordersCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            status: "return_requested",
                            returnRequestedAt: new Date()
                        }
                    }
                );
                notifyClients({
                    type: "order_status_updated",
                    data: {
                        orderId: orderId,
                        status: "return_requested"
                    }
                });
                return NextResponse.json({
                    success: true,
                    boxtalShipmentId: returnRequestOrder.boxtalShipmentId
                });
            case "refund-return":
                const refundOrder = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
                if (!refundOrder) {
                    return NextResponse.json(
                        { error: "Commande introuvable" },
                        { status: 404 }
                    );
                }
                try {
                    if (refundOrder.paymentIntentId) {
                        await stripe.refunds.create({
                            payment_intent: refundOrder.paymentIntentId,
                        });
                    }
                } catch (stripeError: any) {
                    console.error("Erreur remboursement retour:", stripeError);
                    return NextResponse.json(
                        { error: "Erreur lors du remboursement: " + stripeError.message },
                        { status: 500 }
                    );
                }
                await ordersCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            status: "returned",
                            returnedAt: new Date(),
                            refundReason: "retour du colis"
                        },
                        $unset: {
                            shippingData: "",
                            billingData: "",
                            boxtalShipmentId: "",
                            boxtalStatus: "",
                            trackingNumber: ""
                        }
                    }
                );
                notifyClients({
                    type: "order_status_updated",
                    data: {
                        orderId: orderId,
                        status: "returned"
                    }
                });
                return NextResponse.json({
                    success: true,
                    message: "Client remboursé avec succès"
                });
            default:
                return NextResponse.json(
                    { error: "Action invalide" },
                    { status: 400 }
                );
        }
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
        const fullProducts = await productsCollection.find({
            _id: { $in: productIds }
        }).toArray();
        const productsForOrder = fullProducts.map((p: any) => ({
            _id: p._id,
            name: p.name,
            price: p.price,
            description: p.description,
            category: p.category,
            images: p.images || [],
        }));
        const productsTotalPrice = products.reduce((acc: number, product: any) => acc + product.price, 0);
        const totalPrice = productsTotalPrice + (shippingMethod.price || 0);
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
        notifyClients({
            type: "order_created",
            data: { orderId: result.insertedId.toString() }
        });
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