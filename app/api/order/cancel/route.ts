import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise from "../../../lib/mongodb";
import nodemailer from "nodemailer";
import { ObjectId } from "mongodb";
import { notifyClients } from "../../../lib/pusher-server";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Non authentifié" },
                { status: 401 }
            );
        }

        const { orderId, reason, message } = await req.json();

        if (!orderId || !reason) {
            return NextResponse.json(
                { error: "Raison obligatoire" },
                { status: 400 }
            );
        }

        const reasonMap: { [key: string]: string } = {
            "Erreur de commande": "error",
            "Délai trop long": "delay",
            "Changement d'avis": "regret",
            "Autre": "other"
        };

        const reasonKey = reasonMap[reason];
        if (!reasonKey) {
            return NextResponse.json(
                { error: "Raison invalide" },
                { status: 400 }
            );
        }

        const cleanMessage = message?.trim().slice(0, 200) || "";

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");

        const order = await ordersCollection.findOne({
            _id: new ObjectId(orderId),
            userEmail: session.user.email,
        });

        if (!order) {
            return NextResponse.json(
                { error: "Commande introuvable" },
                { status: 404 }
            );
        }

        if (!["paid", "preparing"].includes(order.order.status)) {
            return NextResponse.json(
                { error: "Cette commande ne peut plus être annulée" },
                { status: 400 }
            );
        }

        const transporter = nodemailer.createTransport({
            host: "ssl0.ovh.net",
            port: 465,
            secure: true,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
        });

        const orderDate = new Date(order.order.createdAt).toLocaleDateString("fr-FR");
        const productsList = order.products
            .map((p: any) => p.name)
            .join(", ");
        const escapedReason = reason.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const escapedMessage = cleanMessage
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");

        await transporter.sendMail({
            from: process.env.MAIL_USER,
            to: process.env.MAIL_USER,
            replyTo: session.user.email,
            subject: `Demande d'annulation - Commande du ${orderDate}`,
            html: `
                <h3>Demande d'annulation de commande</h3>
                <p><strong>Client :</strong> ${session.user.email}</p>
                <hr>
                <p><strong>Date de commande :</strong> ${orderDate}</p>
                <p><strong>Montant :</strong> ${order.order.totalPrice.toFixed(2)}€</p>
                <p><strong>Produits :</strong> ${productsList}</p>
                <hr>
                <p><strong>Raison :</strong> ${escapedReason}</p>
                ${cleanMessage ? `<p><strong>Message :</strong></p><p>${escapedMessage}</p>` : ""}
            `,
        });

        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            {
                $set: {
                    "order.status": "cancel_requested",
                    "order.previousStatus": order.order.status,
                    "order.cancelRequestedAt": new Date(),
                    "order.cancelReason": reasonKey,
                    "order.cancelMessage": cleanMessage || undefined,
                }
            }
        );

        await notifyClients({
            type: "order_status_updated",
            data: {
                orderId: orderId,
                status: "cancel_requested"
            }
        });

        return NextResponse.json({ message: "Demande envoyée avec succès" });
    } catch (error) {
        console.error("Erreur demande annulation:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'envoi de la demande" },
            { status: 500 }
        );
    }
}
