import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";
import cloudinary from "../../lib/cloudinary";
import { notifyClients } from "../../lib/pusher-server";
import { stripe } from "../../lib/stripe-server";
import nodemailer from "nodemailer";
import { generateInvoicePdf, generateCreditNotePdf } from "../../lib/generate-invoice";

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
            query = { "order.status": { $in: ['delivered', 'cancelled', 'returned', 'return_delivered'] } };
        } else if (status === 'pending') {
            query = { "order.status": { $in: ['paid', 'preparing', 'in_transit', 'cancel_requested', 'return_requested', 'return_in_transit'] } };
        } else {
            query = { "order.status": status };
        }
        const orders = await ordersCollection
            .find(query)
            .sort({ "order.createdAt": -1 })
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
        const { orderId, action, fullRefund } = await req.json();
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
                if (order.shippingData?.boxtalShipmentId) {
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
                                `${apiUrl}/shipping/v3.1/shipping-order/${order.shippingData.boxtalShipmentId}`,
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
                    if (order.order?.paymentIntentId) {
                        await stripe.refunds.create({
                            payment_intent: order.order.paymentIntentId,
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
                        await notifyClients({
                            type: "product_created",
                            data: { productId: insertResult.insertedId.toString() }
                        });
                    }
                }
                const cancelSlimProducts = order.products.map((p: any) => ({
                    name: p.name,
                    price: p.price,
                    image: p.images?.[0] || "",
                }));
                await ordersCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            "order.status": "cancelled",
                            "order.cancelledAt": new Date(),
                            "order.refundReason": order.order?.cancelReason || "cancelled",
                            products: cancelSlimProducts
                        },
                        $unset: {
                            shippingData: "",
                            billingData: "",
                            "order.cancelReason": "",
                            "order.cancelMessage": "",
                            "order.cancelRequestedAt": "",
                            "order.previousStatus": ""
                        }
                    }
                );
                await notifyClients({
                    type: "order_status_updated",
                    data: {
                        orderId: orderId,
                        status: "cancelled"
                    }
                });
                try {
                    const orderDate = new Date(order.order.createdAt).toLocaleDateString("fr-FR");
                    const productsList = order.products.map((p: any) => `<li>${p.name} - ${p.price.toFixed(2)} €</li>`).join("");
                    const { buffer: creditNoteBuffer, creditNoteNumber } = await generateCreditNotePdf(order, orderId);
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
                        from: process.env.MAIL_USER,
                        to: order.userEmail,
                        subject: `EffCraft - Commande du ${orderDate} annulée et remboursée`,
                        html: `
                            <h2>Votre commande a été annulée</h2>
                            <p>Bonjour,</p>
                            <p>Votre commande du ${orderDate} d'un montant de <strong>${order.order.totalPrice.toFixed(2)} €</strong> a été annulée et le remboursement a été effectué.</p>
                            <h3>Articles concernés</h3>
                            <ul>${productsList}</ul>
                            <p>Le remboursement apparaîtra sur votre compte sous quelques jours ouvrés.</p>
                            <p>Vous trouverez votre facture d'avoir en pièce jointe.</p>
                            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                            <p>Cordialement,<br>L'équipe EffCraft</p>
                        `,
                        attachments: [
                            {
                                filename: `avoir-${creditNoteNumber}.pdf`,
                                content: creditNoteBuffer,
                                contentType: "application/pdf",
                            }
                        ],
                    });
                } catch (mailError) {
                    console.error("Erreur envoi mail de remboursement:", mailError);
                }
                return NextResponse.json({
                    success: true,
                    message: "Commande annulée, client remboursé et produits remis en ligne"
                });
            case "request-return-only":
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
                            "order.status": "return_requested",
                            "order.returnRequestedAt": new Date(),
                            "shippingData.boxtalStatus": "PENDING"
                        }
                    }
                );
                await notifyClients({
                    type: "order_status_updated",
                    data: {
                        orderId: orderId,
                        status: "return_requested"
                    }
                });
                return NextResponse.json({
                    success: true,
                    boxtalShipmentId: returnRequestOrder.shippingData?.boxtalShipmentId
                });

            case "refund-return":
                const refundOrder = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
                if (!refundOrder) {
                    return NextResponse.json(
                        { error: "Commande introuvable" },
                        { status: 404 }
                    );
                }
                const FIXED_PRICES: { [key: string]: number } = {
                    "MONR-CpourToi": 5.90,
                    "SOGP-RelaisColis": 5.90,
                    "POFR-ColissimoAccess": 9.90,
                    "CHRP-Chrono18": 12.90
                };
                const shippingCode = `${refundOrder.shippingData?.shippingMethod?.operator || "MONR"}-${refundOrder.shippingData?.shippingMethod?.serviceCode || "CpourToi"}`;
                const shippingCost = FIXED_PRICES[shippingCode] || 5.90;
                let refundAmount;
                let refundReason;
                if (fullRefund) {
                    refundAmount = Math.round((refundOrder.order.totalPrice - shippingCost) * 100); // en centimes
                    refundReason = `Produit défectueux - Remboursement ${(refundOrder.order.totalPrice - shippingCost).toFixed(2)}€ (frais retour déduits)`;
                } else {
                    refundAmount = Math.round((refundOrder.order.totalPrice - (shippingCost * 2)) * 100); // en centimes
                    refundReason = `Changement d'avis - Remboursement ${(refundOrder.order.totalPrice - (shippingCost * 2)).toFixed(2)}€ (frais aller et retour déduits)`;
                }
                try {
                    if (refundOrder.order?.paymentIntentId && refundAmount > 0) {
                        await stripe.refunds.create({
                            payment_intent: refundOrder.order.paymentIntentId,
                            amount: refundAmount,
                        });
                    }
                } catch (stripeError: any) {
                    console.error("Erreur remboursement retour:", stripeError);
                    return NextResponse.json(
                        { error: "Erreur lors du remboursement: " + stripeError.message },
                        { status: 500 }
                    );
                }
                const returnSlimProducts = refundOrder.products.map((p: any) => ({
                    name: p.name,
                    price: p.price,
                    image: p.images?.[0] || "",
                }));
                await ordersCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            "order.status": "returned",
                            "order.returnedAt": new Date(),
                            "order.refundReason": refundReason,
                            products: returnSlimProducts
                        },
                        $unset: {
                            shippingData: "",
                            billingData: ""
                        }
                    }
                );
                await notifyClients({
                    type: "order_status_updated",
                    data: {
                        orderId: orderId,
                        status: "returned"
                    }
                });
                try {
                    const returnOrderDate = new Date(refundOrder.order.createdAt).toLocaleDateString("fr-FR");
                    const returnProductsList = refundOrder.products.map((p: any) => `<li>${p.name} - ${p.price.toFixed(2)} €</li>`).join("");
                    const refundAmountEuros = refundAmount / 100;
                    const { buffer: returnCreditNoteBuffer, creditNoteNumber: returnCreditNoteNumber } = await generateCreditNotePdf(refundOrder, orderId, refundAmountEuros);
                    const returnTransporter = nodemailer.createTransport({
                        host: "ssl0.ovh.net",
                        port: 465,
                        secure: true,
                        auth: {
                            user: process.env.MAIL_USER,
                            pass: process.env.MAIL_PASSWORD,
                        },
                    });
                    await returnTransporter.sendMail({
                        from: process.env.MAIL_USER,
                        to: refundOrder.userEmail,
                        subject: `EffCraft - Retour traité - Commande du ${returnOrderDate}`,
                        html: `
                            <h2>Votre retour a été traité</h2>
                            <p>Bonjour,</p>
                            <p>Le retour de votre commande du ${returnOrderDate} a été traité. Un remboursement de <strong>${refundAmountEuros.toFixed(2)} €</strong> a été effectué.</p>
                            <h3>Articles concernés</h3>
                            <ul>${returnProductsList}</ul>
                            <p>Le remboursement apparaîtra sur votre compte sous quelques jours ouvrés.</p>
                            <p>Vous trouverez votre facture d'avoir en pièce jointe.</p>
                            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                            <p>Cordialement,<br>L'équipe EffCraft</p>
                        `,
                        attachments: [
                            {
                                filename: `avoir-${returnCreditNoteNumber}.pdf`,
                                content: returnCreditNoteBuffer,
                                contentType: "application/pdf",
                            }
                        ],
                    });
                } catch (mailError) {
                    console.error("Erreur envoi mail de remboursement retour:", mailError);
                }
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
        const { paymentIntentId, shippingData, billingData, products, totalAmount } = await req.json();
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
        const shippingValidation = validateAddressData(shippingData, true);
        if (!shippingValidation.valid) {
            return NextResponse.json(
                { error: shippingValidation.error },
                { status: 400 }
            );
        }
        if (billingData !== "same") {
            const billingValidation = validateAddressData(billingData, false);
            if (!billingValidation.valid) {
                return NextResponse.json(
                    { error: billingValidation.error },
                    { status: 400 }
                );
            }
        }
        const addressValidationResult = await validateFrenchAddress(
            shippingData.rue,
            shippingData.codePostal,
            shippingData.ville
        );
        if (addressValidationResult.status === 'invalid') {
            return NextResponse.json(
                { error: "Adresse de livraison invalide: " + (addressValidationResult.message || "Veuillez vérifier votre saisie") },
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
        const totalPrice = totalAmount;
        await productsCollection.deleteMany({
            _id: { $in: productIds }
        });
        for (const productId of productIds) {
            await notifyClients({
                type: "product_deleted",
                data: { productId: productId.toString() }
            });
        }
        await usersCollection.updateMany(
            { favorites: { $in: productIds } },
            { $pull: { favorites: { $in: productIds } } } as any
        );
        await usersCollection.updateMany(
            { cart: { $in: productIds } },
            { $pull: { cart: { $in: productIds } } } as any
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
            shippingData: shippingData,
            billingData: billingData,
            order: {
                totalPrice: totalPrice,
                paymentIntentId: paymentIntentId,
                status: "paid",
                createdAt: new Date(),
            }
        };
        const result = await ordersCollection.insertOne(order);
        await notifyClients({
            type: "order_created",
            data: { orderId: result.insertedId.toString() }
        });
        try {
            const { buffer, invoiceNumber } = await generateInvoicePdf(
                { ...order, order: { ...order.order, createdAt: order.order.createdAt } },
                result.insertedId.toString()
            );
            const productsList = productsForOrder.map((p: any) => `<li>${p.name} - ${p.price.toFixed(2)} €</li>`).join("");
            const transporter = nodemailer.createTransport({
                host: 'ssl0.ovh.net',
                port: 465,
                secure: true,
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASSWORD,
                },
            });
            await transporter.sendMail({
                from: process.env.MAIL_USER,
                to: session.user.email,
                subject: `EffCraft - Confirmation de commande ${invoiceNumber}`,
                html: `
                    <h2>Merci pour votre commande !</h2>
                    <p>Bonjour ${shippingData.prenom},</p>
                    <p>Votre commande a bien été enregistrée et sera préparée dans les plus brefs délais.</p>
                    <h3>Récapitulatif</h3>
                    <ul>${productsList}</ul>
                    <p><strong>Total : ${totalPrice.toFixed(2)} €</strong></p>
                    <h3>Adresse de livraison</h3>
                    <p>${shippingData.prenom} ${shippingData.nom}<br>
                    ${shippingData.rue}<br>
                    ${shippingData.codePostal} ${shippingData.ville}</p>
                    <p>Vous trouverez votre facture en pièce jointe.</p>
                    <p>À bientôt,<br>L'équipe EffCraft</p>
                `,
                attachments: [
                    {
                        filename: `facture-${invoiceNumber}.pdf`,
                        content: buffer,
                        contentType: "application/pdf",
                    }
                ],
            });
            const shippingMethodName = shippingData.shippingMethod
                ? `${shippingData.shippingMethod.operator} - ${shippingData.shippingMethod.serviceCode}`
                : "Non spécifié";
            const relayInfo = shippingData.shippingMethod?.relayPoint
                ? `<p><strong>Point relais :</strong> ${shippingData.shippingMethod.relayPoint.name}, ${shippingData.shippingMethod.relayPoint.address}, ${shippingData.shippingMethod.relayPoint.zipcode} ${shippingData.shippingMethod.relayPoint.city}</p>`
                : "";
            await transporter.sendMail({
                from: process.env.MAIL_USER,
                to: process.env.MAIL_USER,
                subject: `Nouvelle commande ${invoiceNumber} - ${shippingData.prenom} ${shippingData.nom}`,
                html: `
                    <h2>Nouvelle commande reçue !</h2>
                    <h3>Client</h3>
                    <p>${shippingData.prenom} ${shippingData.nom}<br>
                    ${session.user.email}</p>
                    <h3>Articles</h3>
                    <ul>${productsList}</ul>
                    <p><strong>Total : ${totalPrice.toFixed(2)} €</strong></p>
                    <h3>Livraison</h3>
                    <p><strong>Mode :</strong> ${shippingMethodName}</p>
                    <p>${shippingData.rue}<br>
                    ${shippingData.complement ? shippingData.complement + '<br>' : ''}
                    ${shippingData.codePostal} ${shippingData.ville}<br>
                    ${shippingData.telephone}</p>
                    ${relayInfo}
                `,
                attachments: [
                    {
                        filename: `facture-${invoiceNumber}.pdf`,
                        content: buffer,
                        contentType: "application/pdf",
                    }
                ],
            });
        } catch (mailError) {
            console.error("Erreur envoi mail de confirmation:", mailError);
        }
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
function validateAddressData(data: any, requirePhone: boolean): { valid: boolean; error?: string } {
    if (!data) {
        return { valid: false, error: "Données d'adresse manquantes" };
    }
    const namePattern = /^[A-Za-zÀ-ÿ\s\-']{2,}$/;
    if (!data.nom || !namePattern.test(data.nom.trim())) {
        return { valid: false, error: "Le nom doit contenir au moins 2 caractères (lettres, espaces, tirets, apostrophes uniquement)" };
    }
    if (!data.prenom || !namePattern.test(data.prenom.trim())) {
        return { valid: false, error: "Le prénom doit contenir au moins 2 caractères (lettres, espaces, tirets, apostrophes uniquement)" };
    }
    if (!data.rue || data.rue.trim().length < 3) {
        return { valid: false, error: "La rue doit contenir au moins 3 caractères" };
    }
    const zipPattern = /^\d{5}$/;
    if (!data.codePostal || !zipPattern.test(data.codePostal.trim())) {
        return { valid: false, error: "Le code postal doit contenir exactement 5 chiffres" };
    }
    if (!data.ville || !namePattern.test(data.ville.trim())) {
        return { valid: false, error: "La ville doit contenir au moins 2 caractères (lettres, espaces, tirets, apostrophes uniquement)" };
    }
    if (requirePhone) {
        const phonePattern = /^\d{10}$/;
        if (!data.telephone || !phonePattern.test(data.telephone.trim())) {
            return { valid: false, error: "Le téléphone doit contenir exactement 10 chiffres" };
        }
    }
    return { valid: true };
}
type AddressValidationResult = {
    status: 'valid' | 'unverified' | 'invalid';
    message?: string;
};
async function validateFrenchAddress(address: string | null, zipcode: string, city: string): Promise<AddressValidationResult> {
    try {
        if (!/^\d{5}$/.test(zipcode)) {
            return { status: 'invalid', message: 'Code postal invalide' };
        }
        const query = address ? `${address} ${zipcode} ${city}` : `${zipcode} ${city}`;
        const response = await fetch(
            `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`
        );
        if (!response.ok) {
            console.warn("Erreur API adresse.data.gouv.fr, validation désactivée");
            return {
                status: 'unverified',
                message: 'Votre adresse n\'a pas pu être vérifiée. Veuillez confirmer qu\'elle est correcte avant de continuer.'
            };
        }
        const data = await response.json();
        if (!data.features || data.features.length === 0) {
            console.warn(`Adresse non trouvée dans l'API: ${query}, mais on accepte avec warning`);
            return {
                status: 'unverified',
                message: 'Votre adresse n\'a pas été trouvée dans notre base. Veuillez vérifier qu\'elle est correcte avant de continuer.'
            };
        }
        const result = data.features[0];
        const resultZipcode = result.properties.postcode;
        if (resultZipcode !== zipcode) {
            if (resultZipcode.substring(0, 2) === zipcode.substring(0, 2)) {
                console.warn(`Code postal proche: ${zipcode} vs ${resultZipcode}, accepté avec warning`);
                return {
                    status: 'unverified',
                    message: `Le code postal trouvé (${resultZipcode}) diffère légèrement du vôtre (${zipcode}). Veuillez vérifier votre adresse.`
                };
            }
            console.warn(`Code postal très différent: ${zipcode} vs ${resultZipcode}`);
            return {
                status: 'unverified',
                message: 'Votre adresse n\'a pas été trouvée dans notre base. Veuillez vérifier qu\'elle est correcte avant de continuer.'
            };
        }
        const score = result.properties.score;
        if (score > 0.7) {
            return { status: 'valid' };
        } else {
            return {
                status: 'unverified',
                message: 'Votre adresse est similaire à une adresse connue mais pas exactement identique. Veuillez la vérifier.'
            };
        }
    } catch (error) {
        console.error("Erreur validation adresse:", error);
        return {
            status: 'unverified',
            message: 'Impossible de vérifier votre adresse pour le moment. Veuillez confirmer qu\'elle est correcte.'
        };
    }
}