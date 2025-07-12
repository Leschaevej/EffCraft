"use client";

import React from "react";
import "./Footer.scss";

type Category = "all" | "earrings" | "necklace";

export default function Footer() {
    const handleClick = (filter: Category) => {
        window.dispatchEvent(
        new CustomEvent("filter-from-footer", {
            detail: filter,
        })
        );

        const section = document.getElementById("product");
        if (section) {
        section.scrollIntoView({ behavior: "smooth" });
        }
    };

    const scrollToNew = () => {
        const section = document.getElementById("new");
        if (section) {
        section.scrollIntoView({ behavior: "smooth" });
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
                        <img src="/payment/payPal.webp" alt="PayPal" />
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
                <a href="/legal">Mentions légales</a>
                <a href="/terms">CGV</a>
                <a href="/privacy">Politique de confidentialité</a>
                <a href="/returns">Retour & échanges</a>
                <span>© 2025 Eff Craft</span>
            </div>
        </footer>
    );
}
