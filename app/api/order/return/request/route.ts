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
        const returnItemsRaw = formData.get("returnItems") as string;

        if (!orderId || !reason) {
            return NextResponse.json({ error: "Raison obligatoire" }, { status: 400 });
        }

        let returnItemKeys: string[] = [];
        try {
            returnItemKeys = returnItemsRaw ? JSON.parse(returnItemsRaw) : [];
        } catch {
            return NextResponse.json({ error: "Articles invalides" }, { status: 400 });
        }
        if (returnItemKeys.length === 0) {
            return NextResponse.json({ error: "Sélectionnez au moins un article" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const ordersCollection = db.collection("orders");
        const returnsCollection = db.collection("returns");

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

        // Vérifie qu'il n'y a pas déjà un retour pour cette commande
        const existingReturn = await returnsCollection.findOne({ orderId: new ObjectId(orderId) });
        if (existingReturn) {
            return NextResponse.json({ error: "Une demande de retour a déjà été effectuée pour cette commande" }, { status: 400 });
        }

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        if (!order.order.deliveredAt || new Date(order.order.deliveredAt) < fourteenDaysAgo) {
            return NextResponse.json({ error: "Le délai de retour de 14 jours est dépassé" }, { status: 400 });
        }

        const cleanMessage = message.trim().slice(0, 500);
        const orderDate = new Date(order.order.createdAt).toLocaleDateString("fr-FR");

        // Construire la liste des articles retournés avec leurs prix
        const returnItems = order.products
            .filter((p: any, index: number) => {
                const key = p._id?.toString() || `${orderId}-${index}`;
                return returnItemKeys.includes(key);
            })
            .map((p: any) => ({ name: p.name, price: p.price, image: p.image || p.images?.[0] || "" }));

        if (returnItems.length === 0) {
            return NextResponse.json({ error: "Articles introuvables" }, { status: 400 });
        }

        // Créer le document return dans la collection returns
        const returnResult = await returnsCollection.insertOne({
            orderId: new ObjectId(orderId),
            userEmail: session.user.email,
            items: returnItems,
            reason,
            message: cleanMessage || undefined,
            status: "requested",
            requestedAt: new Date(),
        });

        // Retirer les produits retournés de la commande d'origine
        const returnedNames = new Set(returnItems.map((p: any) => p.name));
        const remainingProducts = order.products.filter((p: any) => !returnedNames.has(p.name));
        const remainingTotal = remainingProducts.reduce((sum: number, p: any) => sum + p.price, 0);
        await ordersCollection.updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { products: remainingProducts, "order.totalPrice": remainingTotal } }
        );

        await notifyClients({
            type: "order_status_updated",
            data: { orderId, status: "return_requested" }
        });

        // Upload photos et envoi mail en arrière-plan (sans bloquer la réponse)
        const photosData = await Promise.all(
            photos.filter(p => p.size > 0).map(async (photo) => ({
                buffer: Buffer.from(await photo.arrayBuffer()),
                type: photo.type,
            }))
        );

        const backgroundTask = async () => {
            try {
                const photoUrls: string[] = [];
                for (const { buffer, type } of photosData) {
                    const base64 = `data:${type};base64,${buffer.toString("base64")}`;
                    const uploadResult = await cloudinary.uploader.upload(base64, {
                        folder: "effcraft/returns",
                    });
                    photoUrls.push(uploadResult.secure_url);
                }

                if (photoUrls.length > 0) {
                    await returnsCollection.updateOne(
                        { _id: returnResult.insertedId },
                        { $set: { photos: photoUrls } }
                    );
                }

                const productsList = returnItems.map((p: any) => `${p.name} (${p.price.toFixed(2)}€)`).join(", ");
                const escapedReason = reason.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const escapedMessage = cleanMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
                const photosHtml = photoUrls.length > 0
                    ? `<p><strong>Photos :</strong></p>${photoUrls.map(url => `<img src="${url}" style="max-width:200px;margin:4px;" />`).join("")}`
                    : "";
                const threadId = order.emailThreadId || `<order-${orderId}@effcraft.fr>`;
                const adminSubject = order.emailSubject ? `Re: ${order.emailSubject}` : `Demande de retour - Commande du ${orderDate}`;

                const transporter = nodemailer.createTransport({
                    host: "ssl0.ovh.net",
                    port: 465,
                    secure: true,
                    auth: {
                        user: process.env.MAIL_USER,
                        pass: process.env.MAIL_PASSWORD,
                    },
                });

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
            } catch (err) {
                console.error("Erreur arrière-plan retour (upload/mail):", err);
            }
        };

        backgroundTask();

        return NextResponse.json({ message: "Demande de retour envoyée avec succès" });
    } catch (error) {
        console.error("Erreur demande retour:", error);
        return NextResponse.json({ error: "Erreur lors de l'envoi de la demande" }, { status: 500 });
    }
}
