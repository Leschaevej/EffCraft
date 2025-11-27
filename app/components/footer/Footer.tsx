"use client";

import React from "react";
import Link from "next/link";
import "./Footer.scss";

type Category = "all" | "earrings" | "necklace";

export default function Footer() {
    const handleClick = (filter: Category) => {
        if (window.location.pathname !== "/") {
            sessionStorage.setItem("scrollToId", "product");
            sessionStorage.setItem("filterFromFooter", filter);
            window.location.href = "/";
        } else {
            window.dispatchEvent(
                new CustomEvent("filter-from-footer", {
                    detail: filter,
                })
            );
            const section = document.getElementById("product");
            if (section) section.scrollIntoView({ behavior: "smooth" });
        }
    };
    const scrollToNew = () => {
        if (window.location.pathname !== "/") {
            sessionStorage.setItem("scrollToId", "new");
            window.location.href = "/";
        } else {
            const section = document.getElementById("new");
            if (section) section.scrollIntoView({ behavior: "smooth" });
        }
    };
    return (
        <footer className="footer">
            <div className="shortcutInfo">
                <div className="shortcut">
                    <h3>LES BIJOUX</h3>
                    <p className="link" onClick={scrollToNew}>Nouveautés</p>
                    <p className="link" onClick={() => handleClick("all")}>Tout</p>
                    <p className="link" onClick={() => handleClick("necklace")}>Colliers</p>
                    <p className="link" onClick={() => handleClick("earrings")}>Boucles d'oreilles</p>
                </div>
                <div className="info">
                    <h3>MODE DE PAIEMENT</h3>
                    <div className="conteneur">
                        <img src="/payment/mastercard.webp" alt="Mastercard" />
                        <img src="/payment/cb.webp" alt="CB" />
                        <img src="/payment/visa.webp" alt="Visa" />
                        <img src="/payment/paypal.webp" alt="PayPal" />
                    </div>
                </div>
                <div className="info">
                    <h3>MODE DE LIVRAISON</h3>
                    <div className="conteneur">
                        <img src="/delivery/colissimo.webp" alt="Colisimo" />
                        <img src="/delivery/chronopost.webp" alt="Chronopost" />
                        <img src="/delivery/mondialRelay.webp" alt="Mondial Relay" />
                        <img src="/delivery/relayColis.webp" alt="Relay Colis" />
                    </div>
                </div>
            </div>
            <div className="social">
                <p>SUIVEZ MOI</p>
                <a href="https://www.instagram.com/tonprofil" target="_blank" rel="noopener noreferrer">
                    <img src="/instagram.webp" alt="Instagram" />
                </a>
                <a href="https://www.tiktok.com/@tonprofil" target="_blank" rel="noopener noreferrer">
                    <img src="/tiktok.webp" alt="TikTok" />
                </a>
            </div>
            <div className="legal">
                <Link href="/legal">Mentions légales</Link>
                <Link href="/terms">CGV</Link>
                <Link href="/privacy">Politique de confidentialité</Link>
                <Link href="/returns">Retour & échanges</Link>
                <span>© 2025 Eff Craft</span>
            </div>
        </footer>
    );
}