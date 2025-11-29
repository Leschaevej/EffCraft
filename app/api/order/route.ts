import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";
import cloudinary from "../../lib/cloudinary";
import { notifyClients } from "../../lib/pusher-server";
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
            query = { status: { $in: ['paid', 'preparing', 'ready', 'in_transit', 'out_for_delivery', 'return_requested'] } };
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
                        await notifyClients({
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
                await notifyClients({
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
                await notifyClients({
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
                await notifyClients({
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

        // Valider les données d'adresse côté serveur
        const shippingValidation = validateAddressData(shippingData, true);
        if (!shippingValidation.valid) {
            return NextResponse.json(
                { error: shippingValidation.error },
                { status: 400 }
            );
        }

        const billingValidation = validateAddressData(billingData, false);
        if (!billingValidation.valid) {
            return NextResponse.json(
                { error: billingValidation.error },
                { status: 400 }
            );
        }

        // Valider l'adresse de livraison avec l'API du gouvernement
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
        const productsTotalPrice = products.reduce((acc: number, product: any) => acc + product.price, 0);
        const totalPrice = productsTotalPrice + (shippingMethod.price || 0);
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

        // Nettoyer et sanitizer les données d'adresse avant de les enregistrer
        const cleanedShippingData: any = {
            nom: shippingData.nom.trim(),
            prenom: shippingData.prenom.trim(),
            rue: shippingData.rue.trim(),
            complement: shippingData.complement ? shippingData.complement.trim() : "",
            codePostal: shippingData.codePostal.trim(),
            ville: shippingData.ville.trim(),
            telephone: shippingData.telephone.trim(),
        };

        // Ajouter le point relais si présent (Mondial Relay, Relais Colis, etc.)
        if (shippingData.relayPoint) {
            cleanedShippingData.relayPoint = shippingData.relayPoint;
        }

        const cleanedBillingData = {
            nom: billingData.nom.trim(),
            prenom: billingData.prenom.trim(),
            rue: billingData.rue.trim(),
            complement: billingData.complement ? billingData.complement.trim() : "",
            codePostal: billingData.codePostal.trim(),
            ville: billingData.ville.trim(),
        };

        const order = {
            userEmail: session.user.email,
            products: productsForOrder,
            totalPrice: totalPrice,
            shippingData: cleanedShippingData,
            billingData: cleanedBillingData,
            shippingMethod: shippingMethod,
            paymentIntentId: paymentIntentId,
            status: "paid",
            createdAt: new Date(),
        };
        const result = await ordersCollection.insertOne(order);
        await notifyClients({
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

// Fonction de validation des patterns d'adresse
function validateAddressData(data: any, requirePhone: boolean): { valid: boolean; error?: string } {
    if (!data) {
        return { valid: false, error: "Données d'adresse manquantes" };
    }

    // Validation nom et prénom
    const namePattern = /^[A-Za-zÀ-ÿ\s\-']{2,}$/;
    if (!data.nom || !namePattern.test(data.nom.trim())) {
        return { valid: false, error: "Le nom doit contenir au moins 2 caractères (lettres, espaces, tirets, apostrophes uniquement)" };
    }
    if (!data.prenom || !namePattern.test(data.prenom.trim())) {
        return { valid: false, error: "Le prénom doit contenir au moins 2 caractères (lettres, espaces, tirets, apostrophes uniquement)" };
    }

    // Validation rue
    if (!data.rue || data.rue.trim().length < 3) {
        return { valid: false, error: "La rue doit contenir au moins 3 caractères" };
    }

    // Validation code postal (5 chiffres)
    const zipPattern = /^\d{5}$/;
    if (!data.codePostal || !zipPattern.test(data.codePostal.trim())) {
        return { valid: false, error: "Le code postal doit contenir exactement 5 chiffres" };
    }

    // Validation ville
    if (!data.ville || !namePattern.test(data.ville.trim())) {
        return { valid: false, error: "La ville doit contenir au moins 2 caractères (lettres, espaces, tirets, apostrophes uniquement)" };
    }

    // Validation téléphone (10 chiffres) - seulement pour l'adresse de livraison
    if (requirePhone) {
        const phonePattern = /^\d{10}$/;
        if (!data.telephone || !phonePattern.test(data.telephone.trim())) {
            return { valid: false, error: "Le téléphone doit contenir exactement 10 chiffres" };
        }
    }

    return { valid: true };
}

// Type pour le résultat de validation d'adresse
type AddressValidationResult = {
    status: 'valid' | 'unverified' | 'invalid';
    message?: string;
};

// Fonction de validation d'adresse avec l'API du gouvernement français
async function validateFrenchAddress(address: string | null, zipcode: string, city: string): Promise<AddressValidationResult> {
    try {
        // Validation basique du code postal français (5 chiffres)
        if (!/^\d{5}$/.test(zipcode)) {
            return { status: 'invalid', message: 'Code postal invalide' };
        }

        // Si pas d'adresse précise, on valide juste le code postal et la ville
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

        // Si aucun résultat mais que le format est correct, on accepte avec un warning
        // (adresses récentes, rurales, non référencées)
        if (!data.features || data.features.length === 0) {
            console.warn(`Adresse non trouvée dans l'API: ${query}, mais on accepte avec warning`);
            return {
                status: 'unverified',
                message: 'Votre adresse n\'a pas été trouvée dans notre base. Veuillez vérifier qu\'elle est correcte avant de continuer.'
            };
        }

        const result = data.features[0];
        const resultZipcode = result.properties.postcode;

        // Vérifier que le code postal correspond (tolérance)
        if (resultZipcode !== zipcode) {
            // Si le département correspond (2 premiers chiffres), on accepte avec warning
            if (resultZipcode.substring(0, 2) === zipcode.substring(0, 2)) {
                console.warn(`Code postal proche: ${zipcode} vs ${resultZipcode}, accepté avec warning`);
                return {
                    status: 'unverified',
                    message: `Le code postal trouvé (${resultZipcode}) diffère légèrement du vôtre (${zipcode}). Veuillez vérifier votre adresse.`
                };
            }
            // Code postal très différent, on demande confirmation
            console.warn(`Code postal très différent: ${zipcode} vs ${resultZipcode}`);
            return {
                status: 'unverified',
                message: 'Votre adresse n\'a pas été trouvée dans notre base. Veuillez vérifier qu\'elle est correcte avant de continuer.'
            };
        }

        // Score de confiance : demander confirmation si pas parfait
        const score = result.properties.score;
        if (score > 0.7) {
            return { status: 'valid' }; // Adresse parfaitement validée
        } else {
            // Score pas assez élevé, on demande confirmation
            return {
                status: 'unverified',
                message: 'Votre adresse est similaire à une adresse connue mais pas exactement identique. Veuillez la vérifier.'
            };
        }

    } catch (error) {
        console.error("Erreur validation adresse:", error);
        // En cas d'erreur, on laisse passer avec un warning
        return {
            status: 'unverified',
            message: 'Impossible de vérifier votre adresse pour le moment. Veuillez confirmer qu\'elle est correcte.'
        };
    }
}