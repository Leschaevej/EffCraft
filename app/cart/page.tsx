"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { nothingYouCouldDo } from "../font";
import Card from "../components/card/Card";
import "./page.scss";

export type Bijou = {
    _id: string;
    name: string;
    price: number;
    images: string[];
    addedAt?: string;
};

export default function Cart() {
    const { data: session, status } = useSession();
    const [panier, setCart] = useState<Bijou[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const fetchCart = async () => {
        if (status !== "authenticated") {
            setLoading(false);
            return;
        }
        try {
            const res = await fetch("/api/user?type=cart", { credentials: "include" });
            const data = await res.json();
            if (res.ok) {
                setCart(data.cart);
                setErrorMessage(null);
            } else {
                setErrorMessage(data.error || "Erreur lors de la récupération du panier");
            }
        } catch {
            setErrorMessage("Erreur réseau lors de la récupération du panier");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCart();
    }, [status]);

    // Écouter les événements SSE pour mettre à jour le panier automatiquement
    useEffect(() => {
        const eventSource = new EventSource("/api/cart");

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Quand un produit devient disponible (cleanup), recharger le panier
            if (data.type === "product_available") {
                fetchCart();
            }
        };

        eventSource.onerror = () => {
            console.error("Erreur SSE sur page panier");
        };

        return () => {
            eventSource.close();
        };
    }, []);
    const handleRemove = async (id: string) => {
        try {
        const res = await fetch("/api/user", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "remove_cart", productId: id }),
        });
        if (res.ok) {
            setCart((prev) => prev.filter((bijou) => bijou._id !== id));
            setErrorMessage(null);
        } else {
            const data = await res.json();
            setErrorMessage(data.error || "Erreur lors de la suppression");
        }
        } catch {
        setErrorMessage("Erreur réseau lors de la suppression");
        }
    };
    const totalPrix = panier.reduce((acc, bijou) => acc + bijou.price, 0);
    const isLoading = status === "loading" || (status === "authenticated" && loading);

    if (isLoading) {
        return <p>Chargement du panier...</p>;
    }
    return (
        <main className={`cart ${status === "unauthenticated" ? "unloged" : ""}`}>
            <div className="conteneur">
                <h2 className={nothingYouCouldDo.className}>Panier</h2>
                {status === "unauthenticated" ? (
                    <>
                        <div className="loginFav">
                            <p>Veuillez vous connecter pour voir votre panier !</p>

                            <button className="google" onClick={() => signIn("google")}>
                                <img src="/google.webp" alt="Google" />
                                Se connecter avec Google
                            </button>
                            <button className="facebook" onClick={() => alert("Connexion Facebook")}>
                                <img src="/facebook.webp" alt="Facebook" />
                                Se connecter avec Facebook
                            </button>
                            <button className="apple" onClick={() => alert("Connexion Apple")}>
                                <img src="/apple.webp" alt="Apple" />
                                Se connecter avec Apple
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {errorMessage && (
                            <div className="error" onClick={() => setErrorMessage(null)}>
                                {errorMessage}
                            </div>
                        )}
                        {panier.length === 0 ? (
                            <p>Votre panier est vide.</p>
                        ) : (
                <div className="listTotal">
                    <ul className="list">
                        {panier.map((bijou) => (
                            <li key={bijou._id} className="item">
                                <div className="image">
                                    <Card
                                    bijou={bijou as any}
                                    clickable={false}
                                    showName={false}
                                    showPrice={false}
                                    showFavori={false}
                                    />
                                </div>
                                <div className="info">
                                    <h3>{bijou.name}</h3>
                                    <p>{bijou.price} €</p>
                                    <button onClick={() => handleRemove(bijou._id)} className="remove">
                                    Supprimer
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="total">
                        <p>Total : <strong>{totalPrix} €</strong></p>
                        <button className="valider">Valider la commande</button>
                    </div>
                </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}