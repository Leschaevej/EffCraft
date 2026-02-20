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
            return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
        }

        const { orderId } = await req.json();
        if (!orderId) {
            return NextResponse.json({ error: "orderId manquant" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");

        const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
        if (!order) {
            return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
        }

        if (order.order.status !== "return_requested") {
            return NextResponse.json({ error: "Cette commande n'a pas de demande de retour en cours" }, { status: 400 });
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
        const threadId = order.emailThreadId || `<order-${orderId}@effcraft.fr>`;
        const subject = order.emailSubject || `EffCraft - Mise à jour de votre commande du ${orderDate}`;

        await transporter.sendMail({
            from: `"EffCraft" <${process.env.MAIL_USER}>`,
            to: order.userEmail,
            subject,
            inReplyTo: threadId,
            references: threadId,
            headers: {
                "X-Mailer": "EffCraft Mailer",
                "Organization": "EffCraft",
            },
            html: `
                <h2>Demande de retour</h2>
                <p>Bonjour,</p>
                <p>Nous avons bien reçu votre demande de retour pour la commande du ${orderDate} d'un montant de ${order.order.totalPrice.toFixed(2)}€.</p>
                <p>Après examen, nous ne sommes malheureusement pas en mesure d'accepter cette demande.</p>
                <p>Si vous avez des questions, n'hésitez pas à nous contacter en répondant à cet email.</p>
                <p>Cordialement,<br>L'équipe EffCraft</p>
            `,
        });

        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            {
                $set: { "order.status": "delivered" },
                $unset: {
                    "order.returnReason": "",
                    "order.returnMessage": "",
                    "order.returnPhotos": "",
                    "order.returnRequestedAt": "",
                }
            }
        );

        await notifyClients({
            type: "order_status_updated",
            data: { orderId, status: "delivered" }
        });

        return NextResponse.json({ message: "Demande de retour refusée, client notifié" });
    } catch (error) {
        console.error("Erreur refus retour:", error);
        return NextResponse.json({ error: "Erreur lors du refus de la demande" }, { status: 500 });
    }
}
