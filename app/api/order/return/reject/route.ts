import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise from "../../../../lib/mongodb";
import nodemailer from "nodemailer";
import { ObjectId } from "mongodb";
import { notifyClients } from "../../../../lib/pusher-server";
import cloudinary from "../../../../lib/cloudinary";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || session.user.role !== "admin") {
            return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
        }

        const { returnId, rejectReason } = await req.json();
        if (!returnId) {
            return NextResponse.json({ error: "returnId manquant" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const returnsCollection = db.collection("returns");
        const ordersCollection = db.collection("orders");

        const ret = await returnsCollection.findOne({ _id: new ObjectId(returnId) });
        if (!ret) {
            return NextResponse.json({ error: "Retour introuvable" }, { status: 404 });
        }
        if (ret.status !== "requested") {
            return NextResponse.json({ error: "Ce retour n'est pas en attente d'acceptation" }, { status: 400 });
        }

        const order = await ordersCollection.findOne({ _id: ret.orderId });
        if (!order) {
            return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
        }

        // Supprimer les photos Cloudinary
        if (ret.photos?.length > 0) {
            for (const photoUrl of ret.photos) {
                try {
                    const match = photoUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
                    if (match && match[1]) {
                        await cloudinary.uploader.destroy(match[1]);
                    }
                } catch (e) {
                    console.error("Erreur suppression photo retour Cloudinary:", e);
                }
            }
        }

        // Mettre à jour le retour
        await returnsCollection.updateOne(
            { _id: new ObjectId(returnId) },
            {
                $set: {
                    status: "rejected",
                    rejectedAt: new Date(),
                    ...(rejectReason && { rejectReason }),
                },
                $unset: { photos: "" }
            }
        );

        await notifyClients({
            type: "order_status_updated",
            data: { orderId: ret.orderId.toString(), status: "return_rejected" }
        });

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
        const threadId = order.emailThreadId || `<order-${ret.orderId.toString()}@effcraft.fr>`;
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

        return NextResponse.json({ message: "Demande de retour refusée, client notifié" });
    } catch (error) {
        console.error("Erreur refus retour:", error);
        return NextResponse.json({ error: "Erreur lors du refus de la demande" }, { status: 500 });
    }
}
