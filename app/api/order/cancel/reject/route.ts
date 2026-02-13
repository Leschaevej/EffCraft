import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise from "../../../../lib/mongodb";
import nodemailer from "nodemailer";
import { ObjectId } from "mongodb";
import { notifyClients } from "../../../../lib/pusher-server";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || session.user.role !== "admin") {
            return NextResponse.json(
                { error: "Non autorisé" },
                { status: 403 }
            );
        }

        const { orderId, message } = await req.json();

        if (!orderId || !message?.trim()) {
            return NextResponse.json(
                { error: "Message obligatoire" },
                { status: 400 }
            );
        }

        const cleanMessage = message.trim().slice(0, 2000);

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");

        const order = await ordersCollection.findOne({
            _id: new ObjectId(orderId),
        });

        if (!order) {
            return NextResponse.json(
                { error: "Commande introuvable" },
                { status: 404 }
            );
        }

        if (order.order.status !== "cancel_requested") {
            return NextResponse.json(
                { error: "Cette commande n'a pas de demande d'annulation en cours" },
                { status: 400 }
            );
        }

        const previousStatus = order.order.previousStatus || "paid";

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
        const escapedMessage = cleanMessage
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");

        await transporter.sendMail({
            from: process.env.MAIL_USER,
            to: order.userEmail,
            subject: `EffCraft - Demande d'annulation refusée - Commande du ${orderDate}`,
            html: `
                <h2>Demande d'annulation refusée</h2>
                <p>Bonjour,</p>
                <p>Votre demande d'annulation pour la commande du ${orderDate} d'un montant de ${order.order.totalPrice.toFixed(2)}€ a été refusée.</p>
                <h3>Message de l'équipe EffCraft :</h3>
                <p>${escapedMessage}</p>
                <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                <p>Cordialement,<br>L'équipe EffCraft</p>
            `,
        });

        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            {
                $set: {
                    "order.status": previousStatus,
                },
                $unset: {
                    "order.cancelReason": "",
                    "order.cancelMessage": "",
                    "order.cancelRequestedAt": "",
                    "order.previousStatus": "",
                }
            }
        );

        await notifyClients({
            type: "order_status_updated",
            data: {
                orderId: orderId,
                status: previousStatus
            }
        });

        return NextResponse.json({ message: "Demande refusée et client notifié" });
    } catch (error) {
        console.error("Erreur refus annulation:", error);
        return NextResponse.json(
            { error: "Erreur lors du refus de la demande" },
            { status: 500 }
        );
    }
}
