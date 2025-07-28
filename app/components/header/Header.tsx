"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FaShoppingBag, FaHeart, FaBars, FaUser } from "react-icons/fa";
import { signIn, signOut, useSession } from "next-auth/react";
import "./Header.scss";

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [menuVisible, setMenuVisible] = useState(false);
    const [loginVisible, setLoginVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const handleLogoClick = (e: React.MouseEvent) => {
        if (pathname === "/") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };
    const handleSectionClick = (sectionId: string) => {
        closeAllMenus();
        if (pathname === "/") {
        const section = document.getElementById(sectionId);
        section?.scrollIntoView({ behavior: "smooth" });
        } else {
        sessionStorage.setItem("scrollToId", sectionId);
        router.push("/");
        }
    };
    const closeAllMenus = () => {
        if (menuOpen) {
        setMenuOpen(false);
        setTimeout(() => setMenuVisible(false), 300);
        }
        if (loginOpen) {
        setLoginOpen(false);
        setTimeout(() => setLoginVisible(false), 300);
        }
    };

    const toggleMenu = () => {
        if (menuOpen) {
            setMenuOpen(false);
            setTimeout(() => setMenuVisible(false), 300);
        } else {
            setMenuVisible(true);
            setTimeout(() => setMenuOpen(true), 10);
            if (loginOpen) {
            setLoginOpen(false);
            setTimeout(() => setLoginVisible(false), 300);
            }
        }
    };
    const toggleLogin = () => {
    if (loginOpen) {
        setLoginOpen(false);
        setTimeout(() => setLoginVisible(false), 300);
    } else {
        setLoginVisible(true);
        setTimeout(() => setLoginOpen(true), 10);
        if (menuOpen) {
        setMenuOpen(false);
        setTimeout(() => setMenuVisible(false), 300);
        }
    }
    };
    return (
        <>
        <header className="header">
            <h1 className="logo">
            <Link href="/" onClick={handleLogoClick}>
                <img src="/logo.webp" alt="Logo Eff Craft" />
            </Link>
            </h1>
            <nav>
                <FaUser className="icon" onClick={toggleLogin} />
                <Link href="/favorites">
                    <FaHeart className="icon" />
                </Link>

                <FaShoppingBag className="icon" />
                <FaBars className="icon" onClick={toggleMenu} />
            </nav>
        </header>
        {(menuOpen || loginOpen) && (
            <div className="overlay" onClick={closeAllMenus} />
        )}
        {menuVisible && (
            <div className={`menu ${menuOpen ? "open" : "closed"}`}>
                <ul>
                    <li>
                        <a onClick={() => handleSectionClick("new")}>Nouveautés</a>
                    </li>
                    <li>
                        <a onClick={() => handleSectionClick("product")}>Bijoux</a>
                    </li>
                    <li>
                        <a onClick={() => handleSectionClick("event")}>Événements</a>
                    </li>
                    <li>
                        <a onClick={() => handleSectionClick("contact")}>Contact</a>
                    </li>
                </ul>
                <div className="social">
                    <a
                        href="https://www.instagram.com/tonprofil"
                        target="_blank"
                        rel="noopener noreferrer"
                        >
                        <img src="/instagram.webp" alt="Instagram" />
                    </a>
                    <a
                        href="https://www.tiktok.com/@tonprofil"
                        target="_blank"
                        rel="noopener noreferrer"
                        >
                        <img src="/tiktok.webp" alt="TikTok" />
                    </a>
                </div>
            </div>
        )}
        {loginVisible && (
            <div className={`login ${loginOpen ? "open" : "closed"}`}>
                {status === "loading" ? (
                    <p>Chargement...</p>
                ) : session?.user ? (
                    <>
                    <p>Bonjour, {session.user.name}</p>

                    {session?.user?.role === "admin" ? (
                        <button
                            className="backoffice"
                            onClick={() => {
                                closeAllMenus();
                                router.push("/backoffice");
                            }}
                            >
                            Backoffice
                        </button>
                    ) : (
                        <button
                            className="commande"
                            onClick={() => {
                                closeAllMenus();
                                router.push("/commande");
                            }}
                            >
                            Commande
                        </button>
                    )}
                    <button className="logout" onClick={() => signOut()}>
                        Se déconnecter
                    </button>
                    </>
                ) : (
                    <>
                    <button className="google" onClick={() => signIn("google")}>
                        <img src="/google.webp" alt="Google" />
                        Se connecter avec Google
                    </button>
                    <button
                        className="facebook"
                        onClick={() => alert("Connexion Facebook")}
                    >
                        <img src="/facebook.webp" alt="Facebook" />
                        Se connecter avec Facebook
                    </button>
                    <button className="apple" onClick={() => alert("Connexion Apple")}>
                        <img src="/apple.webp" alt="Apple" />
                        Se connecter avec Apple
                    </button>
                    </>
                )}
            </div>
        )}
        </>
    );
}