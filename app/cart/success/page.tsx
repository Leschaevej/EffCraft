"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { nothingYouCouldDo } from "../../font";
import "./page.scss";

export default function PaymentSuccess() {
    const searchParams = useSearchParams();
    const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const paymentIntent = searchParams.get('payment_intent');

    useEffect(() => {
        if (paymentIntent) {
            // Vérifier le statut du paiement
            fetch(`/api/payment/verify?payment_intent=${paymentIntent}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'succeeded') {
                        setPaymentStatus('success');
                    } else {
                        setPaymentStatus('error');
                    }
                })
                .catch(() => setPaymentStatus('error'));
        }
    }, [paymentIntent]);

    return (
        <main className="payment-success">
            <div className="conteneur">
                <h2 className={nothingYouCouldDo.className}>
                    {paymentStatus === 'loading' && 'Vérification du paiement...'}
                    {paymentStatus === 'success' && 'Paiement réussi !'}
                    {paymentStatus === 'error' && 'Erreur de paiement'}
                </h2>

                {paymentStatus === 'loading' && (
                    <p className="message">Veuillez patienter pendant que nous vérifions votre paiement...</p>
                )}

                {paymentStatus === 'success' && (
                    <div className="success-content">
                        <p className="message">Merci pour votre commande ! Votre paiement a été traité avec succès.</p>
                        <p>Vous allez recevoir un email de confirmation sous peu.</p>
                        <a href="/" className="button">Retour à l'accueil</a>
                    </div>
                )}

                {paymentStatus === 'error' && (
                    <div className="error-content">
                        <p className="message">Une erreur est survenue lors du traitement de votre paiement.</p>
                        <a href="/cart" className="button">Retour au panier</a>
                    </div>
                )}
            </div>
        </main>
    );
}
