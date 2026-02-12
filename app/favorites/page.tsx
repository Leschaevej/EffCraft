"use client";

import React, { useEffect, useState } from "react";
import Card from "../components/card/Card";
import CardSkeleton from "../components/card/CardSkeleton";
import { useSession, signIn } from "next-auth/react";
import { nothingYouCouldDo } from "../font";
import { useFavorites } from "../hooks/useFavorites";
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
    const [favorites, setFavorites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFavorites = async (showLoading = false) => {
        if (status === "loading") {
            return;
        }
        if (status !== "authenticated") {
            setLoading(false);
            return;
        }
        if (showLoading) {
            setLoading(true);
        }
        try {
            const res = await fetch("/api/user?type=favorites");
            if (res.ok) {
                const data = await res.json();
                setFavorites(data.favorites || []);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des favoris:", error);
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        if (status !== "loading") {
            setLoading(true);
            fetchFavorites(false).finally(() => setLoading(false));
        }
    }, [status]);

    useEffect(() => {
        const handleRemoved = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { productId } = customEvent.detail;
            // Mise à jour locale immédiate sans squelette
            setFavorites(prev => prev.filter((f: any) => {
                const fId = typeof f === 'string' ? f : f._id;
                return fId !== productId;
            }));
        };

        const handleAdded = () => {
            // Refetch avec squelette car on ne peut pas ajouter à la liste optimistement
            fetchFavorites(true);
        };

        window.addEventListener("removed", handleRemoved);
        window.addEventListener("favorite-added", handleAdded);
        return () => {
            window.removeEventListener("removed", handleRemoved);
            window.removeEventListener("favorite-added", handleAdded);
        };
    }, [status]);

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
                    {loading ? (
                    <div className="grid">
                        {Array.from({ length: 3 }, (_, i) => (
                        <CardSkeleton key={`skeleton-${i}`} />
                        ))}
                    </div>
                    ) : favorites.length > 0 ? (
                        <div className="grid">
                            {favorites.map((bijou) => (
                                <Card key={bijou._id} bijou={bijou} initialIsFavori={true} />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-message">
                            <p>Vous n'avez encore ajouté aucun bijou à vos favoris.</p>
                        </div>
                    )}
                </>
                )}
            </div>
        </main>
    );
}