"use client";

import React, { useState, useEffect } from "react";
import "./Card.scss";
import Link from "next/link";
import { useSession } from "next-auth/react";

type Bijou = {
    _id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    images: string[];
};
type CardProps = {
    bijou: Bijou;
    clickable?: boolean;
    showPrice?: boolean;
    imageReplacement?: React.ReactNode;
    initialIsFavori?: boolean;
};
const HeartOutline = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        {...props}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);
const HeartFill = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        {...props}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);
export default function Card({
    bijou,
    clickable = true,
    showPrice = true,
    imageReplacement,
    initialIsFavori = false,
}: CardProps) {
    const { data: session } = useSession();
    const [isFavori, setIsFavori] = useState(initialIsFavori);
    const [loading, setLoading] = useState(false);
        useEffect(() => {
        setIsFavori(initialIsFavori);
    }, [initialIsFavori]);
    const toggleFavori = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!session?.user) {
        alert("Vous devez être connecté pour gérer les favoris");
        return;
        }
        setLoading(true);
        const method = isFavori ? "DELETE" : "POST";
        try {
        const res = await fetch("/api/user/favorites", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: bijou._id }),
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Erreur lors de la requête");
        }
        setIsFavori(!isFavori);
        } catch (error) {
        alert("Erreur lors de la mise à jour des favoris");
        console.error(error);
        }
        setLoading(false);
    };
    const content = (
        <div className="card">
            <div className="card-image">
                {imageReplacement ? (
                imageReplacement
                ) : (
                <img src={bijou.images?.[0] ?? "/default.jpg"} alt={bijou.name} />
                )}
                <button
                className={`favori ${isFavori ? "favori-active" : ""}`}
                onClick={toggleFavori}
                aria-label={isFavori ? "Retirer des favoris" : "Ajouter aux favoris"}
                disabled={loading}
                >
                {isFavori ? <HeartFill /> : <HeartOutline />}
                </button>
            </div>
            <h3>{bijou.name}</h3>
            {showPrice && <p className="prix">{bijou.price} €</p>}
        </div>
    );
    return clickable ? <Link href={`/products/${bijou._id}`}>{content}</Link> : content;
}