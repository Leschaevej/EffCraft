import { NextRequest, NextResponse } from "next/server";
import { stripe } from "../../../lib/stripe-server";

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const paymentIntentId = searchParams.get('payment_intent');

        if (!paymentIntentId) {
            return NextResponse.json(
                { error: "Payment Intent ID manquant" },
                { status: 400 }
            );
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        return NextResponse.json({
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
        });
    } catch (error: any) {
        console.error("Erreur vérification Payment Intent:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la vérification du paiement" },
            { status: 500 }
        );
    }
}
