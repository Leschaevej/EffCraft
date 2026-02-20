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

        const { orderId } = await req.json();

        if (!orderId) {
            return NextResponse.json(
                { error: "orderId manquant" },
                { status: 400 }
            );
        }

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

        await transporter.sendMail({
            from: `"EffCraft" <${process.env.MAIL_USER}>`,
            to: order.userEmail,
            subject: `EffCraft - Mise à jour de votre commande du ${orderDate}`,
            inReplyTo: threadId,
            references: threadId,
            headers: {
                "X-Mailer": "EffCraft Mailer",
                "Organization": "EffCraft",
            },
            html: `
                <h2>Mise à jour de votre commande</h2>
                <p>Bonjour,</p>
                <p>Nous avons bien reçu votre demande concernant votre commande du ${orderDate} d'un montant de ${order.order.totalPrice.toFixed(2)}€.</p>
                <p>Malheureusement, votre colis est déjà en cours d'acheminement et nous ne sommes plus en mesure de l'intercepter.</p>
                <p>Vous pouvez suivre votre livraison depuis votre espace commandes.</p>
                <p>Si vous souhaitez retourner votre commande après réception, vous pourrez effectuer une demande de retour depuis votre espace client.</p>
                <p>Cordialement,<br>L'équipe EffCraft</p>
            `,
        });

        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            {
                $set: {
                    "order.status": "in_transit",
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
                status: "in_transit"
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
