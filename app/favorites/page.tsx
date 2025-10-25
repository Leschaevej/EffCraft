"use client";

import React, { useEffect, useState } from "react";
import Card from "../components/card/Card";
import CardSkeleton from "../components/card/CardSkeleton";
import { useSession, signIn } from "next-auth/react";
import { nothingYouCouldDo } from "../font";
import "./page.scss";

type Bijou = {
    _id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    images: string[];
};
export default function Favorites() {
    const { data: session, status } = useSession();
    const [favorites, setFavorites] = useState<Bijou[] | null>(null);
    const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (status !== "authenticated") return;
        const fetchFavorites = async () => {
        try {
            const res = await fetch("/api/user?type=favorites");
            if (!res.ok) throw new Error("Erreur lors du chargement des favoris");
            const data = await res.json();
            setFavorites(data.favorites || []);
        } catch (err) {
            setFavorites([]);
        }
        };
        fetchFavorites();
    }, [status]);
    useEffect(() => {
        const handleFavoriteRemoved = (e: Event) => {
            const customEvent = e as CustomEvent<{ productId: string }>;
            const productId = customEvent.detail.productId;
            setRemovingIds(prev => new Set(prev).add(productId));
            setTimeout(() => {
                setFavorites(prev => prev ? prev.filter(bijou => bijou._id !== productId) : prev);
                setRemovingIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(productId);
                    return newSet;
                });
            }, 3000);
        };
        window.addEventListener("removed", handleFavoriteRemoved);
        return () => window.removeEventListener("removed", handleFavoriteRemoved);
    }, []);
    const isLoading = status === "loading" || (status === "authenticated" && favorites === null);
    return (
        <main className={`favorites ${status === "unauthenticated" ? "unloged" : ""}`}>
            <div className="conteneur">
                <h2 className={nothingYouCouldDo.className}>Vos favoris</h2>
                    {status === "unauthenticated" ? (
                    <>
                        <div className="loginFav">
                        <p>Veuillez vous connecter pour voir vos favoris !</p>

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
                    {isLoading && (
                    <div className="grid">
                        {Array.from({ length: 6 }, (_, i) => (
                        <CardSkeleton key={`skeleton-${i}`} />
                        ))}
                    </div>
                    )}
                    {!isLoading && Array.isArray(favorites) && favorites.length > 0 && (
                    <div className="grid">
                        {favorites.map((bijou) => (
                        <div
                            key={bijou._id}
                            className={removingIds.has(bijou._id) ? "removing" : ""}
                        >
                            <Card bijou={bijou} initialIsFavori={true} />
                        </div>
                        ))}
                    </div>
                    )}
                    {!isLoading && Array.isArray(favorites) && favorites.length === 0 && (
                    <p>Vous n’avez encore ajouté aucun bijou à vos favoris.</p>
                    )}
                </>
                )}
            </div>
        </main>
    );
}