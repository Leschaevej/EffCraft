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
    const { favorites: swrFavorites, isLoading: swrLoading } = useFavorites();

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
                    {swrLoading ? (
                    <div className="grid">
                        {Array.from({ length: 3 }, (_, i) => (
                        <CardSkeleton key={`skeleton-${i}`} />
                        ))}
                    </div>
                    ) : swrFavorites.length > 0 ? (
                    <div className="grid">
                        {swrFavorites.map((bijou) => (
                            <Card key={bijou._id} bijou={bijou} initialIsFavori={true} />
                        ))}
                    </div>
                    ) : (
                    <p>Vous n'avez encore ajouté aucun bijou à vos favoris.</p>
                    )}
                </>
                )}
            </div>
        </main>
    );
}