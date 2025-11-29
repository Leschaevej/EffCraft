"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import "./page.scss";
import Card from "../../components/card/Card";
import AddToCartButton from "../AddToCart";
import { useRealtime } from "../../context/Realtime";
import { useFavorites } from "../../hooks/useFavorites";

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
    const router = useRouter();
    const id = params.id as string;
    const [bijou, setBijou] = useState<Bijou | null>(null);
    const [loading, setLoading] = useState(true);
    const [justAddedToCart, setJustAddedToCart] = useState(false);
    const { reservedProducts, availableProducts, currentUserId } = useRealtime();
    const { favorites } = useFavorites();
    const lastFetchedState = useRef<string>("");
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
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    };
    useEffect(() => {
        fetchProduct();
    }, [id]);
    useEffect(() => {
        if (bijou && (reservedProducts.has(bijou._id) || availableProducts.has(bijou._id))) {
            const currentState = `${reservedProducts.has(bijou._id)}-${availableProducts.has(bijou._id)}`;
            if (currentState !== lastFetchedState.current) {
                lastFetchedState.current = currentState;
                setTimeout(() => {
                    fetchProduct(true);
                }, 100);
            }
        }
        if (bijou && availableProducts.has(bijou._id)) {
            setJustAddedToCart(false);
        }
    }, [reservedProducts, availableProducts, bijou]);
    useEffect(() => {
        const handleRealtimeUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { type, productId } = customEvent.detail;
            if (type === "product_deleted" && productId === id) {
                sessionStorage.setItem("productDeletedMessage", "Ce produit vient d'être vendu");
                router.push("/");
            }
        };
        window.addEventListener("cart-update", handleRealtimeUpdate);
        return () => window.removeEventListener("cart-update", handleRealtimeUpdate);
    }, [id, router]);
    if (loading) {
        return (
            <main className="product">
                <div className="conteneur">
                    <div className="card skeleton">
                        <div className="image-skeleton" />
                    </div>
                    <div className="info">
                        <div className="skeleton-line title" />
                        <div className="skeleton-line price" />
                        <div className="skeleton-line description" />
                        <button className="addCart" disabled>Ajouter au panier</button>
                    </div>
                </div>
            </main>
        );
    }
    if (!bijou) return notFound();
    const isReserved = availableProducts.has(bijou._id)
        ? false
        : (reservedProducts.has(bijou._id) || bijou.status === "reserved");
    const isReservedByMe = isReserved && (
        bijou.reservedBy === currentUserId ||
        justAddedToCart
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
                    initialIsFavori={favorites.some((f: any) => (typeof f === 'string' ? f : f._id) === bijou._id)}
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