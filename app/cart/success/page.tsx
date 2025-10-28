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
            const pendingOrderStr = localStorage.getItem('pendingOrder');
            if (!pendingOrderStr) {
                setPaymentStatus('error');
                return;
            }
            const pendingOrder = JSON.parse(pendingOrderStr);
            fetch(`/api/payment/verify?payment_intent=${paymentIntent}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'succeeded') {
                        return fetch('/api/order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                paymentIntentId: paymentIntent,
                                products: pendingOrder.products,
                                shippingData: pendingOrder.shippingData,
                                billingData: pendingOrder.billingData,
                                shippingMethod: pendingOrder.shippingMethod,
                            }),
                        });
                    } else {
                        setPaymentStatus('error');
                    }
                })
                .then(res => res?.json())
                .then(orderData => {
                    if (orderData?.success) {
                        setPaymentStatus('success');
                        localStorage.removeItem('pendingOrder');
                        localStorage.removeItem('panier');
                        window.dispatchEvent(new Event('storage'));
                        window.dispatchEvent(new Event('cart-update'));
                    } else {
                        setPaymentStatus('error');
                    }
                })
                .catch(() => setPaymentStatus('error'));
        }
    }, [paymentIntent]);
    return (
        <main className="success">
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
                    <div className="content">
                        <p className="message">Merci pour votre commande ! Votre paiement a été traité avec succès.</p>
                        <p>Vous allez recevoir un email de confirmation sous peu.</p>
                        <a href="/" className="button">Retour à l'accueil</a>
                    </div>
                )}
                {paymentStatus === 'error' && (
                    <div className="content">
                        <p className="message">Une erreur est survenue lors du traitement de votre paiement.</p>
                        <a href="/cart" className="button">Retour au panier</a>
                    </div>
                )}
            </div>
        </main>
    );
}