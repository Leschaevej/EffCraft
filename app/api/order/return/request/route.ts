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
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const formData = await req.formData();
        const orderId = formData.get("orderId") as string;
        const reason = formData.get("reason") as string;
        const message = (formData.get("message") as string) || "";
        const photos = formData.getAll("photos") as File[];

        if (!orderId || !reason) {
            return NextResponse.json({ error: "Raison obligatoire" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");

        const order = await ordersCollection.findOne({
            _id: new ObjectId(orderId),
            userEmail: session.user.email,
        });

        if (!order) {
            return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
        }

        if (order.order.status !== "delivered") {
            return NextResponse.json({ error: "Cette commande ne peut pas faire l'objet d'un retour" }, { status: 400 });
        }

        // Upload des photos sur Cloudinary si présentes
        const photoUrls: string[] = [];
        for (const photo of photos) {
            if (photo.size > 0) {
                const arrayBuffer = await photo.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64 = `data:${photo.type};base64,${buffer.toString("base64")}`;
                const uploadResult = await cloudinary.uploader.upload(base64, {
                    folder: "effcraft/returns",
                });
                photoUrls.push(uploadResult.secure_url);
            }
        }

        const cleanMessage = message.trim().slice(0, 500);
        const orderDate = new Date(order.order.createdAt).toLocaleDateString("fr-FR");
        const productsList = order.products.map((p: any) => p.name).join(", ");
        const escapedReason = reason.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const escapedMessage = cleanMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

        const transporter = nodemailer.createTransport({
            host: "ssl0.ovh.net",
            port: 465,
            secure: true,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
        });

        const photosHtml = photoUrls.length > 0
            ? `<p><strong>Photos :</strong></p>${photoUrls.map(url => `<img src="${url}" style="max-width:200px;margin:4px;" />`).join("")}`
            : "";

        const threadId = order.emailThreadId || `<order-${orderId}@effcraft.fr>`;
        const adminSubject = order.emailSubject ? `Re: ${order.emailSubject}` : `Demande de retour - Commande du ${orderDate}`;

        await transporter.sendMail({
            from: `"EffCraft" <${process.env.MAIL_USER}>`,
            to: process.env.MAIL_USER,
            replyTo: session.user.email,
            subject: adminSubject,
            inReplyTo: threadId,
            references: threadId,
            headers: {
                "X-Mailer": "EffCraft Mailer",
                "Organization": "EffCraft",
            },
            html: `
                <h3>Demande de retour</h3>
                <p><strong>Client :</strong> ${session.user.email}</p>
                <hr>
                <p><strong>Date de commande :</strong> ${orderDate}</p>
                <p><strong>Montant :</strong> ${order.order.totalPrice.toFixed(2)}€</p>
                <p><strong>Produits :</strong> ${productsList}</p>
                <hr>
                <p><strong>Raison :</strong> ${escapedReason}</p>
                ${cleanMessage ? `<p><strong>Message :</strong></p><p>${escapedMessage}</p>` : ""}
                ${photosHtml}
            `,
        });

        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            {
                $set: {
                    "order.status": "return_requested",
                    "order.returnRequestedAt": new Date(),
                    "order.returnReason": reason,
                    "order.returnMessage": cleanMessage || undefined,
                    "order.returnPhotos": photoUrls.length > 0 ? photoUrls : undefined,
                }
            }
        );

        await notifyClients({
            type: "order_status_updated",
            data: { orderId, status: "return_requested" }
        });

        return NextResponse.json({ message: "Demande de retour envoyée avec succès" });
    } catch (error) {
        console.error("Erreur demande retour:", error);
        return NextResponse.json({ error: "Erreur lors de l'envoi de la demande" }, { status: 500 });
    }
}
