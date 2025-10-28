"use client";

import React, { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import "./PaymentForm.scss";

type PaymentFormProps = {
    clientSecret: string;
    userEmail?: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
};
export default function PaymentForm({ clientSecret, userEmail, onSuccess, onError }: PaymentFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) {
            return;
        }
        setIsProcessing(true);
        setErrorMessage(null);
        try {
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/cart/success`,
                },
            });
            if (error) {
                setErrorMessage(error.message || "Une erreur est survenue");
                if (onError) {
                    onError(error.message || "Une erreur est survenue");
                }
            } else {
                if (onSuccess) {
                    onSuccess();
                }
            }
        } catch (err) {
            setErrorMessage("Une erreur est survenue lors du paiement");
            if (onError) {
                onError("Une erreur est survenue lors du paiement");
            }
        } finally {
            setIsProcessing(false);
        }
    };
    return (
        <form onSubmit={handleSubmit} className="payment">
            <PaymentElement
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
            <button type="submit" disabled={!stripe || isProcessing} className="button">
                {isProcessing ? "Traitement..." : "Payer maintenant"}
            </button>
        </form>
    );
}