"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FaShoppingBag, FaHeart, FaBars, FaUser } from "react-icons/fa";
import { signIn, signOut, useSession } from "next-auth/react";
import "./Header.scss";

function CartTimer() {
    const { data: session } = useSession();
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [expiryTime, setExpiryTime] = useState<Date | null>(null);
    useEffect(() => {
        const handleCartUpdate = () => {
            if (session?.user) {
                checkCartExpiry();
            }
        };
        window.addEventListener("cart-update", handleCartUpdate);
        return () => {
            window.removeEventListener("cart-update", handleCartUpdate);
        };
    }, [session]);
    const checkCartExpiry = async () => {
        if (!session?.user) {
            setTimeLeft(null);
            setExpiryTime(null);
            return;
        }
        try {
            const res = await fetch("/api/user?type=cart");
            if (!res.ok) {
                setTimeLeft(null);
                return;
            }
            const data = await res.json();
            if (!data.cart || data.cart.length === 0 || !data.cartExpiresAt) {
                setTimeLeft(null);
                setExpiryTime(null);
                return;
            }
            const expiry = new Date(data.cartExpiresAt);
            setExpiryTime(expiry);
        } catch (error) {
        }
    };
    useEffect(() => {
        checkCartExpiry();
    }, [session]);
    useEffect(() => {
        if (!expiryTime) {
            setTimeLeft(null);
            return;
        }
        const updateTimer = () => {
            const now = new Date();
            const diff = expiryTime.getTime() - now.getTime();
            if (diff <= 0) {
                setTimeLeft(0);
                fetch("/api/cart?action=cleanup", { method: "POST" }).then(() => {
                    checkCartExpiry();
                });
                return;
            }
            setTimeLeft(Math.floor(diff / 1000));
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [expiryTime]);
    if (timeLeft === null) return null;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return (
        <div className="timer">
            <span className="text">
                Réservé pour : {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
        </div>
    );
}
export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [menuVisible, setMenuVisible] = useState(false);
    const [loginVisible, setLoginVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [showHeader, setShowHeader] = useState(true);
    const [isClosingMenuOrLogin, setIsClosingMenuOrLogin] = useState(false);
    let closingCount = 0;
    const checkEndClosing = () => {
        closingCount++;
        const expectedClosures = (menuOpen ? 1 : 0) + (loginOpen ? 1 : 0);
        if (closingCount >= expectedClosures) {
            setIsClosingMenuOrLogin(false);
            closingCount = 0;
        }
    };
    const closeMenusOnly = () => {
        if (menuOpen || loginOpen) {
            setIsClosingMenuOrLogin(true);
            closingCount = 0;
            if (menuOpen) {
                setMenuOpen(false);
                setTimeout(() => {
                    setMenuVisible(false);
                    checkEndClosing();
                }, 300);
            } else {
                closingCount++;
            }
            if (loginOpen) {
                setLoginOpen(false);
                setTimeout(() => {
                    setLoginVisible(false);
                    checkEndClosing();
                }, 300);
            } else {
                closingCount++;
            }
            setTimeout(() => {
                setIsClosingMenuOrLogin(false);
            }, 300);
        }
    };
    const closeAllMenus = () => {
        if (menuOpen || loginOpen) {
            setIsClosingMenuOrLogin(true);
            closingCount = 0;
            if (menuOpen) {
                setMenuOpen(false);
                setTimeout(() => {
                    setMenuVisible(false);
                    checkEndClosing();
                }, 300);
            } else {
                closingCount++;
            }
            if (loginOpen) {
                setLoginOpen(false);
                setTimeout(() => {
                    setLoginVisible(false);
                    checkEndClosing();
                }, 300);
            } else {
                closingCount++;
            }
            setTimeout(() => {
                setShowHeader(false);
                setIsClosingMenuOrLogin(false);
            }, 600);
        }
    };
    const controlHeader = () => {
        if (typeof window !== "undefined") {
            if (isClosingMenuOrLogin) return;
            const currentScrollY = window.scrollY;
            const scrollingUp = currentScrollY < lastScrollY || currentScrollY <= 0;
            if (!scrollingUp && (loginOpen || menuOpen)) {
                closeAllMenus();
                setTimeout(() => {
                    setShowHeader(false);
                }, 300);
                setLastScrollY(currentScrollY);
                return;
            }
            if (scrollingUp && (loginOpen || menuOpen)) {
                closeMenusOnly();
                setLastScrollY(currentScrollY);
                return;
            }
            setShowHeader(scrollingUp);
            setLastScrollY(currentScrollY);
        }
    };
    useEffect(() => {
        window.addEventListener("scroll", controlHeader);
        return () => window.removeEventListener("scroll", controlHeader);
    }, [lastScrollY, isClosingMenuOrLogin, menuOpen, loginOpen]);
    useEffect(() => {
        const openLoginListener = () => {
            setShowHeader(true);
            if (!loginOpen) {
                setLoginVisible(true);
                setTimeout(() => setLoginOpen(true), 10);
            }
        };
        document.addEventListener("open-login-panel", openLoginListener);
        return () => {
            document.removeEventListener("open-login-panel", openLoginListener);
        };
    }, [loginOpen]);
    useEffect(() => {
        if (typeof window !== "undefined") {
            const scrollPos = sessionStorage.getItem("scrollPos");
            if (scrollPos) {
                window.scrollTo(0, parseInt(scrollPos));
                sessionStorage.removeItem("scrollPos");
            }
        }
    }, []);
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
    const toggleMenu = () => {
        if (menuOpen) {
            closeMenusOnly();
        } else {
            if (loginOpen) {
                closeMenusOnly();
                setTimeout(() => {
                    setMenuVisible(true);
                    setTimeout(() => setMenuOpen(true), 50);
                }, 300);
            } else {
                setMenuVisible(true);
                setTimeout(() => setMenuOpen(true), 10);
            }
        }
    };
    const toggleLogin = () => {
        if (loginOpen) {
            closeMenusOnly();
        } else {
            if (menuOpen) {
                closeMenusOnly();
                setTimeout(() => {
                    setLoginVisible(true);
                    setTimeout(() => setLoginOpen(true), 50);
                }, 300);
            } else {
                setLoginVisible(true);
                setTimeout(() => setLoginOpen(true), 10);
            }
        }
    };
    return (
        <>
            <header className={`header ${showHeader ? "show" : "hide"}`}>
                <h1 className="logo">
                    <Link href="/" onClick={handleLogoClick}>
                        <img src="/logo.webp" alt="Logo Eff Craft" />
                    </Link>
                </h1>
                <div className="right">
                    <CartTimer />
                    <nav>
                        <FaUser className="icon" onClick={toggleLogin} />
                        <Link href="/favorites">
                            <FaHeart className="icon" />
                        </Link>
                        <Link href="/cart">
                            <FaShoppingBag className="icon" />
                        </Link>
                        <FaBars className="icon" onClick={toggleMenu} />
                    </nav>
                </div>
            </header>
            {(menuOpen || loginOpen) && (
                <div className="overlay" onClick={closeMenusOnly} />
            )}
            {menuVisible && (
                <div className={`menu ${menuOpen ? "open" : "closed"}`}>
                    <ul>
                        <li><a onClick={() => handleSectionClick("new")}>Nouveautés</a></li>
                        <li><a onClick={() => handleSectionClick("product")}>Bijoux</a></li>
                        <li><a onClick={() => handleSectionClick("event")}>Événements</a></li>
                        <li><a onClick={() => handleSectionClick("contact")}>Contact</a></li>
                    </ul>
                    <div className="social">
                        <a href="https://www.instagram.com/tonprofil" target="_blank" rel="noopener noreferrer">
                            <img src="/instagram.webp" alt="Instagram" />
                        </a>
                        <a href="https://www.tiktok.com/@tonprofil" target="_blank" rel="noopener noreferrer">
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
                            {session.user.role === "admin" ? (
                                <button className="backoffice" onClick={() => {
                                    closeMenusOnly();
                                    router.push("/backoffice");
                                }}>
                                    Backoffice
                                </button>
                            ) : (
                                <button className="commande" onClick={() => {
                                    closeMenusOnly();
                                    router.push("/order");
                                }}>
                                    Commande
                                </button>
                            )}
                            <button className="logout" onClick={() => signOut()}>
                                Se déconnecter
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="google" onClick={() => {
                                sessionStorage.setItem("scrollPos", window.scrollY.toString());
                                signIn("google");
                            }}>
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
                        </>
                    )}
                </div>
            )}
        </>
    );
}