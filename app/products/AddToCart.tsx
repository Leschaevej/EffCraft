"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Bijou = {
    _id: string;
    name: string;
    price: number;
    images: string[];
};
export default function AddToCartButton({ bijou }: { bijou: Bijou }) {
    const [showModal, setShowModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const router = useRouter();
    const handleAddToCart = async () => {
        try {
        const res = await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "addCart", productId: bijou._id }),
        });
        const data = await res.json();
        if (res.ok) {
            const expireTimestamp = new Date(data.expiresAt).getTime();
            const cart = JSON.parse(localStorage.getItem("cart") || "[]");
            cart.push({
            _id: bijou._id,
            name: bijou.name,
            price: bijou.price,
            images: bijou.images,
            expiresAt: expireTimestamp,
            });
            localStorage.setItem("cart", JSON.stringify(cart));
            const nextExpire = Math.min(...cart.map((item: any) => item.expiresAt));
            localStorage.setItem("nextExpire", nextExpire.toString());
            window.dispatchEvent(new Event("cartUpdated"));
            setShowModal(true);
        } else {
            setErrorMessage(data.error || "Erreur lors de la réservation.");
        }
        } catch (error) {
        setErrorMessage("Erreur réseau.");
        }
    };
    const handleGoToCart = () => {
        setShowModal(false);
        router.push("/cart");
    };
    return (
        <>
        <button className="addCart" onClick={handleAddToCart}>
            Ajouter au panier
        </button>
        {showModal && (
            <div className="overlay" onClick={() => setShowModal(false)}>
                <div className="content" onClick={(e) => e.stopPropagation()}>
                    <h3>Produit ajouté au panier !</h3>
                    <p>Ce produit a été réservé pour vous pendant 15 minutes.<br />En raison de son caractère unique, il est temporairement bloqué.</p>
                    <div className="buttons">
                        <button onClick={() => setShowModal(false)}>Continuer vos achats</button>
                        <button onClick={handleGoToCart}>Aller au panier</button>
                    </div>
                </div>
            </div>
        )}
        {errorMessage && (
            <div className="error-message" onClick={() => setErrorMessage(null)}>
                {errorMessage}
            </div>
        )}
        </>
    );
}