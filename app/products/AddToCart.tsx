"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useReservation } from "../context/Reservation";

type Bijou = {
    _id: string;
    name: string;
    price: number;
    images: string[];
    status?: string;
    reservedBy?: string | null;
};
interface AddToCartButtonProps {
    bijou: Bijou;
    onAddedToCart?: () => void;
}
export default function AddToCartButton({ bijou, onAddedToCart }: AddToCartButtonProps) {
    const { data: session } = useSession();
    const [showModal, setShowModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { reservedProducts, availableProducts } = useReservation();
    const isReserved = availableProducts.has(bijou._id)
        ? false
        : (reservedProducts.has(bijou._id) || bijou.status === "reserved");
    const router = useRouter();
    useEffect(() => {
        const addPendingCart = async () => {
            const pendingId = sessionStorage.getItem("pendingCart");
            if (pendingId && session?.user && pendingId === bijou._id) {
                sessionStorage.removeItem("pendingCart");
                try {
                    const res = await fetch("/api/user", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ action: "addCart", productId: pendingId }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                        onAddedToCart?.();
                        setShowModal(true);
                    } else if (res.status === 409) {
                        setShowErrorModal(true);
                    } else {
                        setError(data.error || "Erreur lors de l'ajout au panier.");
                    }
                } catch {
                    setError("Erreur réseau.");
                }
            }
        };
        addPendingCart();
    }, [session?.user, bijou._id]);
    const handleAddToCart = async () => {
        if (!session?.user) {
            sessionStorage.setItem("pendingCart", bijou._id);
            document.dispatchEvent(new Event("open-login-panel"));
            return;
        }
        onAddedToCart?.();
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
            const nextExpire = Math.min(...cart.map((item: { expiresAt: number }) => item.expiresAt));
            localStorage.setItem("nextExpire", nextExpire.toString());
            window.dispatchEvent(new Event("cartUpdated"));
            setShowModal(true);
        } else if (res.status === 409) {
            setShowErrorModal(true);
        } else {
            setError(data.error || "Erreur lors de la réservation.");
        }
        } catch {
        setError("Erreur réseau.");
        }
    };
    const handleGoToCart = () => {
        setShowModal(false);
        router.push("/cart");
    };
    const handleContinueShopping = () => {
        setShowModal(false);
        router.push("/");
    };
    const handleBackToHome = () => {
        setShowErrorModal(false);
        router.push("/");
    };
    return (
        <>
        <button
            className={`addCart ${isReserved ? "reserved" : ""}`}
            onClick={handleAddToCart}
            disabled={isReserved}
        >
            {isReserved ? "Produit réservé" : "Ajouter au panier"}
        </button>
        {showModal && (
            <div className="overlay" onClick={() => setShowModal(false)}>
                <div className="content" onClick={(e) => e.stopPropagation()}>
                    <h3>Produit ajouté au panier !</h3>
                    <p>Ce produit a été réservé pour vous pendant 15 minutes.<br />En raison de son caractère unique, il est temporairement bloqué.</p>
                    <div className="buttons">
                        <button onClick={handleContinueShopping}>Continuer vos achats</button>
                        <button onClick={handleGoToCart}>Aller au panier</button>
                    </div>
                </div>
            </div>
        )}
        {showErrorModal && (
            <div className="overlay" onClick={() => setShowErrorModal(false)}>
                <div className="content" onClick={(e) => e.stopPropagation()}>
                    <h3>Désolé !</h3>
                    <p>Ce produit a été victime de son succès.<br />Il a déjà été réservé par un autre utilisateur.</p>
                    <div className="buttons">
                        <button onClick={handleBackToHome}>Retour à la page principale</button>
                    </div>
                </div>
            </div>
        )}
        {error && (
            <div className="overlay" onClick={() => setError(null)}>
                <div className="content" onClick={(e) => e.stopPropagation()}>
                    <h3>Erreur</h3>
                    <p>{error}</p>
                    <div className="buttons">
                        <button onClick={() => setError(null)}>Fermer</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}