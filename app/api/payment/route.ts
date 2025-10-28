import { NextRequest, NextResponse } from "next/server";
import { stripe } from "../../lib/stripe-server";

export async function POST(req: NextRequest) {
    try {
        const { amount, currency = "eur" } = await req.json();

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { error: "Le montant est invalide" },
                { status: 400 }
            );
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe utilise les centimes
            currency,
            payment_method_types: ['card', 'paypal', 'revolut_pay'],
            payment_method_options: {
                card: {
                    request_three_d_secure: 'automatic',
                },
            },
            automatic_payment_methods: {
                enabled: false,
            },
        });

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error: any) {
        console.error("Erreur création Payment Intent:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la création du paiement" },
            { status: 500 }
        );
    }
}
