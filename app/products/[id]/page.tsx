"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import "./page.scss";
import Card from "../../components/card/Card";
import AddToCartButton from "../AddToCart";
import { useReservation } from "../../context/ReservationContext";

type Bijou = {
    _id: string;
    name: string;
    description: string;
    price: number;
    images: string[];
    category?: string;
    status?: string;
    reservedBy?: string | null;
};

export default function ProductPage() {
    const params = useParams();
    const id = params.id as string;
    const [bijou, setBijou] = useState<Bijou | null>(null);
    const [loading, setLoading] = useState(true);
    const [justAddedToCart, setJustAddedToCart] = useState(false);
    const { reservedProducts, availableProducts, currentUserId } = useReservation();

    const fetchProduct = async (silent = false) => {
        try {
            const res = await fetch(`/api/products/${id}`);
            if (!res.ok) {
                notFound();
                return;
            }
            const data = await res.json();
            setBijou(data);
        } catch (error) {
            console.error("Erreur lors du chargement du produit:", error);
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchProduct();
    }, [id]);

    // Refetch silencieux le produit quand il est réservé/libéré pour mettre à jour reservedBy
    useEffect(() => {
        if (bijou && (reservedProducts.has(bijou._id) || availableProducts.has(bijou._id))) {
            // Petit délai pour laisser la DB se mettre à jour
            setTimeout(() => {
                fetchProduct(true);
            }, 100);
        }
    }, [reservedProducts, availableProducts]);

    if (loading) return <p>Chargement...</p>;
    if (!bijou) return notFound();

    // Vérifier le statut réservé en temps réel via SSE
    const isReserved = availableProducts.has(bijou._id)
        ? false
        : (reservedProducts.has(bijou._id) || bijou.status === "reserved");

    // Vérifier si c'est l'utilisateur actuel qui a réservé
    const isReservedByMe = isReserved && (
        bijou.reservedBy === currentUserId ||
        justAddedToCart // Si on vient de l'ajouter, c'est forcément nous
    );

    const handleAddedToCart = () => {
        setJustAddedToCart(true);
    };

    return (
        <main className="product">
            <div className="conteneur">
                <Card
                    bijou={bijou}
                    clickable={false}
                    showPrice={false}
                    showName={false}
                />
                <div className="info">
                    <h3>{bijou.name}</h3>
                    <div className="price-container">
                        <p className="price">{bijou.price} €</p>
                        {isReserved && (
                            <p className="reserved-status">
                                {isReservedByMe ? "DANS LE PANIER" : "RÉSERVÉ"}
                            </p>
                        )}
                    </div>
                    <p className="description">{bijou.description}</p>
                    <AddToCartButton bijou={bijou} onAddedToCart={handleAddedToCart} />
                </div>
            </div>
        </main>
    );
}