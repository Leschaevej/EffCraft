"use client";

import React, { useEffect, useState } from "react";
import Card from "../components/card/Card";
import CardSkeleton from "../components/card/CardSkeleton";
import { useSession, signIn } from "next-auth/react";
import { nothingYouCouldDo } from "../font";
import { useFavorites } from "../hooks/useFavorites";
import { usePusher } from "../hooks/usePusher";
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
    const { data: session, status, update } = useSession();
    const [favorites, setFavorites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [magicEmail, setMagicEmail] = useState("");
    const [magicStatus, setMagicStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

    usePusher("magic_link_signed_in", async (data: { email: string; oneTimeToken: string }) => {
        await signIn("magic-link-credentials", {
            email: data.email,
            oneTimeToken: data.oneTimeToken,
            redirect: false,
        });
        await update();
    });

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
                    <div className="loginFav">
                        <p>Connectez-vous pour voir vos favoris</p>
                        {magicStatus === "sent" ? (
                            <div className="magic-sent">
                                <p>Vérifiez votre boîte mail !</p>
                                <span>Un lien de connexion vous a été envoyé.</span>
                                <button className="magic-back" onClick={() => { setMagicStatus("idle"); setMagicEmail(""); }}>Retour</button>
                            </div>
                        ) : (
                            <>
                                <button className="google" onClick={() => signIn("google", { callbackUrl: window.location.href })}>
                                    <img src="/google.webp" alt="Google" />
                                    Se connecter avec Google
                                </button>
                                <div className="magic-divider"><span>ou</span></div>
                                <div className="magic-form">
                                    <input
                                        type="email"
                                        placeholder="Votre adresse email"
                                        value={magicEmail}
                                        onChange={(e) => setMagicEmail(e.target.value)}
                                        disabled={magicStatus === "sending"}
                                    />
                                    <button
                                        className="magic-submit"
                                        disabled={!magicEmail.includes("@") || magicStatus === "sending"}
                                        onClick={async () => {
                                            setMagicStatus("sending");
                                            try {
                                                const res = await fetch("/api/auth/magic-link", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ email: magicEmail, callbackUrl: window.location.href }),
                                                });
                                                setMagicStatus(res.ok ? "sent" : "error");
                                            } catch {
                                                setMagicStatus("error");
                                            }
                                        }}
                                    >
                                        {magicStatus === "sending" ? "Envoi..." : "Recevoir un lien"}
                                    </button>
                                    {magicStatus === "error" && <span className="magic-error">Une erreur est survenue, réessayez.</span>}
                                </div>
                            </>
                        )}
                    </div>
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