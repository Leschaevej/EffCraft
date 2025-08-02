"use client";

import { useEffect, useState } from "react";
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
    const [panier, setCart] = useState<Bijou[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    useEffect(() => {
        const fetchCart = async () => {
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
        fetchCart();
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
    if (loading) {
        return <p>Chargement du panier...</p>;
    }
    return (
        <main className="cart">
            <div className="conteneur">
                <h2 className={nothingYouCouldDo.className}>Panier</h2>
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
            </div>
        </main>
    );
}