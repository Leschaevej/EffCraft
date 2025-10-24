"use client";

import React, { useState, useEffect } from "react";
import "./Card.scss";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useReservation } from "../../context/ReservationContext";
import ArrowButton from "../../components/Arrow";

type Bijou = {
    _id: string;
    name: string;
    description: string;
    price: number;
    category?: string;
    images: string[];
    status?: string;
    reservedBy?: string | null;
};
type CardProps = {
    bijou: Bijou;
    clickable?: boolean;
    showPrice?: boolean;
    showName?: boolean;
    imageReplacement?: React.ReactNode;
    initialIsFavori?: boolean;
    showFavori?: boolean;
};
const HeartOutline = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        {...props}
        viewBox="0 0 30 30"
        fill="transparent"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M16.8428 3.8418C18.3375 2.09401 20.3559 1.2998 22.3242 1.54297L22.7168 1.60547C25.8973 2.22632 28.4998 5.55548 28.5 9.79395V10.1914C28.5 12.6938 27.6108 15.042 26.1064 16.6797L26.1045 16.6816L15.5166 28.2402C15.3361 28.437 15.1468 28.5 15 28.5C14.8532 28.5 14.6639 28.437 14.4834 28.2402L3.89551 16.6816L3.89355 16.6797L3.61914 16.3643C2.28183 14.7478 1.5 12.5374 1.5 10.1914V9.79395C1.50018 5.68774 3.94289 2.43539 6.9873 1.67188L7.2832 1.60547C9.37294 1.19829 11.5629 1.97757 13.1572 3.8418L13.8604 4.66406L15 5.99707L16.1396 4.66406L16.8428 3.8418Z" />
    </svg>
);
const HeartFill = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        {...props}
        viewBox="0 0 30 30"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M16.8428 3.8418C18.3375 2.09401 20.3559 1.2998 22.3242 1.54297L22.7168 1.60547C25.8973 2.22632 28.4998 5.55548 28.5 9.79395V10.1914C28.5 12.6938 27.6108 15.042 26.1064 16.6797L26.1045 16.6816L15.5166 28.2402C15.3361 28.437 15.1468 28.5 15 28.5C14.8532 28.5 14.6639 28.437 14.4834 28.2402L3.89551 16.6816L3.89355 16.6797L3.61914 16.3643C2.28183 14.7478 1.5 12.5374 1.5 10.1914V9.79395C1.50018 5.68774 3.94289 2.43539 6.9873 1.67188L7.2832 1.60547C9.37294 1.19829 11.5629 1.97757 13.1572 3.8418L13.8604 4.66406L15 5.99707L16.1396 4.66406L16.8428 3.8418Z" />
    </svg>
);
export default function Card({
    bijou,
    clickable = true,
    showPrice = true,
    showName = true,
    imageReplacement,
    initialIsFavori = false,
    showFavori = true,
}: CardProps) {
    const { data: session } = useSession();
    const { reservedProducts, availableProducts, currentUserId } = useReservation();
    const [isFavori, setIsFavori] = useState(initialIsFavori);
    const [loading, setLoading] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Si SSE a notifié que le produit est disponible, c'est prioritaire
    // Sinon on se fie au contexte réservé ou au status de la DB
    const isReserved = availableProducts.has(bijou._id)
        ? false
        : (reservedProducts.has(bijou._id) || bijou.status === "reserved");

    // Vérifier si c'est l'utilisateur actuel qui a réservé
    const isReservedByMe = isReserved && bijou.reservedBy === currentUserId;
    useEffect(() => {
    const addPendingFavori = async () => {
        const pendingId = sessionStorage.getItem("pendingFavori");
        if (pendingId && session?.user) {
        try {
            const res = await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "add_favorite",
                productId: pendingId
            }),
            });
            if (res.ok) {
            if (pendingId === bijou._id) {
                setIsFavori(true);
            }
            sessionStorage.removeItem("pendingFavori");
            } else {
            const data = await res.json();
            console.error("Erreur favori après login :", data.error);
            }
        } catch (err) {
            console.error("Erreur réseau favori après login :", err);
        }
        }
    };
    addPendingFavori();
    }, [session?.user, bijou._id]);
    useEffect(() => {
        setIsFavori(initialIsFavori);
    }, [initialIsFavori]);
    const toggleFavori = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!session?.user) {
        sessionStorage.setItem("pendingFavori", bijou._id);
        document.dispatchEvent(new Event("open-login-panel"));
        return;
        }
        setLoading(true);
        const method = isFavori ? "DELETE" : "POST";
        try {
        const res = await fetch("/api/user", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: isFavori ? "remove_favorite" : "add_favorite",
                productId: bijou._id,
            }),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Erreur lors de la requête");
        }
        setIsFavori(!isFavori);

        // Émettre un événement si le favori a été retiré
        if (isFavori) {
            window.dispatchEvent(new CustomEvent("favorite-removed", {
                detail: { productId: bijou._id }
            }));
        }
        } catch (error) {
        console.error(error);
        }
        setLoading(false);
    };
    const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % bijou.images.length);
    };
    const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? bijou.images.length - 1 : prev - 1));
    };
    const content = (
        <div className="card">
        <div className="card-image">
            {imageReplacement ? (
            imageReplacement
            ) : (
            <>
                <ArrowButton direction="left" onClick={prevImage} />
                <img src={bijou.images?.[currentIndex] ?? "/default.jpg"} alt={bijou.name} />
                <ArrowButton direction="right" onClick={nextImage} />
            </>
            )}
            {showFavori && (
            <button
                className={`favori ${isFavori ? "favori-active" : ""}`}
                onClick={toggleFavori}
                aria-label={isFavori ? "Retirer des favoris" : "Ajouter aux favoris"}
                disabled={loading}
            >
                {isFavori ? <HeartFill /> : <HeartOutline />}
            </button>
            )}
        </div>
        {showName && <h3>{bijou.name}</h3>}
        {showPrice && (
            <div className="price-container">
                <p className="prix">{bijou.price} €</p>
                {isReserved && (
                    <p className="reserved-status">
                        {isReservedByMe ? "DANS LE PANIER" : "RÉSERVÉ"}
                    </p>
                )}
            </div>
        )}
        </div>
    );
    return clickable ? <Link href={`/products/${bijou._id}`}>{content}</Link> : content;
}