"use client";

import React, { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import "./PaymentForm.scss";

type PaymentFormProps = {
    clientSecret: string;
    userEmail?: string;
    onSuccess?: (paymentIntentId: string) => void;
    onError?: (error: string) => void;
};
export default function PaymentForm({ clientSecret, userEmail, onSuccess, onError }: PaymentFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) {
            return;
        }
        setIsProcessing(true);
        setErrorMessage(null);
        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required',
            });
            if (error) {
                setErrorMessage(error.message || "Une erreur est survenue");
                if (onError) {
                    onError(error.message || "Une erreur est survenue");
                }
                setIsProcessing(false);
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                if (onSuccess) {
                    onSuccess(paymentIntent.id);
                }
            }
        } catch (err) {
            setErrorMessage("Une erreur est survenue lors du paiement");
            if (onError) {
                onError("Une erreur est survenue lors du paiement");
            }
            setIsProcessing(false);
        }
    };
    return (
        <form onSubmit={handleSubmit} className="payment">
            <PaymentElement
                onReady={() => setIsReady(true)}
                options={{
                    layout: {
                        type: 'accordion',
                        defaultCollapsed: true,
                        radios: false,
                        spacedAccordionItems: true,
                    },
                    wallets: {
                        applePay: 'auto',
                        googlePay: 'auto',
                    },
                    defaultValues: {
                        billingDetails: {
                            email: userEmail || '',
                        },
                    },
                }}
            />
            {errorMessage && <div className="error">{errorMessage}</div>}
            <button type="submit" disabled={!stripe || !isReady || isProcessing} className="button">
                {isProcessing ? "Paiement en cours..." : "Payer maintenant"}
            </button>
        </form>
    );
}
