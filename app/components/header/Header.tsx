"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FaShoppingBag, FaHeart, FaBars, FaUser } from "react-icons/fa";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePusher } from "../../hooks/usePusher";
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
    const { data: session, status, update } = useSession();
    const [menuVisible, setMenuVisible] = useState(false);
    const [loginVisible, setLoginVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [magicEmail, setMagicEmail] = useState("");
    const [magicStatus, setMagicStatus] = useState<"idle" | "sending" | "sent" | "error" | "connected">("idle");
    const magicStatusRef = useRef(magicStatus);
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
    // Garde la ref à jour pour l'utiliser dans le callback Pusher
    useEffect(() => {
        magicStatusRef.current = magicStatus;
    }, [magicStatus]);

    // Pusher : dès que le lien magique est cliqué, connecte l'onglet original via one-time token
    const handleMagicLinkSignedIn = useCallback(async (data: { email: string; oneTimeToken: string }) => {
        await signIn("magic-link-credentials", {
            email: data.email,
            oneTimeToken: data.oneTimeToken,
            redirect: false,
        });
        await update();
        setMagicStatus("connected");
        setMagicEmail("");
        setTimeout(() => {
            setLoginOpen(false);
            setTimeout(() => {
                setLoginVisible(false);
                setTimeout(() => {
                    setMagicStatus("idle");
                }, 50);
            }, 350);
        }, 2000);
    }, [update]);

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return;
            if (!e.data || e.data.type !== "google-signed-in") return;
            if (e.data.error || !e.data.email || !e.data.oneTimeToken) return;
            await signIn("magic-link-credentials", {
                email: e.data.email,
                oneTimeToken: e.data.oneTimeToken,
                redirect: false,
            });
            await update();
            setMagicStatus("connected");
            setTimeout(() => {
                setLoginOpen(false);
                setTimeout(() => {
                    setLoginVisible(false);
                    setTimeout(() => {
                        setMagicStatus("idle");
                    }, 50);
                }, 350);
            }, 2000);
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [update]);

    usePusher("magic_link_signed_in", handleMagicLinkSignedIn);
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
                        <div className="userIconWrapper">
                            <FaUser className="icon" onClick={toggleLogin} />
                            {!session?.user && <span className="badge"></span>}
                        </div>
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
                    {magicStatus === "connected" ? (
                        <div className="magic-sent">
                            <p className="magic-connected">Vous êtes connecté !</p>
                        </div>
                    ) : status === "loading" ? (
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
                    ) : magicStatus === "sent" ? (
                        <div className="magic-sent">
                            <p>Vérifiez votre boîte mail !</p>
                            <p className="magic-hint">Un lien de connexion vous a été envoyé.</p>
                            <button className="magic-back" onClick={() => { setMagicStatus("idle"); setMagicEmail(""); }}>Retour</button>
                        </div>
                    ) : (
                        <>
                            <button className="google" onClick={async () => {
                                const callbackUrl = `${window.location.origin}/api/auth/google`;
                                const csrf = await fetch("/api/auth/csrf").then(r => r.json());
                                const width = 500;
                                const height = 600;
                                const left = window.screenX + (window.outerWidth - width) / 2;
                                const top = window.screenY + (window.outerHeight - height) / 2;
                                window.open("", "google-signin-popup", `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`);
                                const form = document.createElement("form");
                                form.method = "POST";
                                form.action = `/api/auth/signin/google`;
                                form.target = "google-signin-popup";
                                const csrfInput = document.createElement("input");
                                csrfInput.type = "hidden";
                                csrfInput.name = "csrfToken";
                                csrfInput.value = csrf.csrfToken;
                                const cbInput = document.createElement("input");
                                cbInput.type = "hidden";
                                cbInput.name = "callbackUrl";
                                cbInput.value = callbackUrl;
                                form.appendChild(csrfInput);
                                form.appendChild(cbInput);
                                document.body.appendChild(form);
                                form.submit();
                                document.body.removeChild(form);
                            }}>
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
                                            const res = await fetch("/api/auth/link", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    email: magicEmail,
                                                    callbackUrl: window.location.href,
                                                }),
                                            });
                                            if (res.ok) {
                                                setMagicStatus("sent");
                                            } else {
                                                setMagicStatus("error");
                                            }
                                        } catch {
                                            setMagicStatus("error");
                                        }
                                    }}
                                >
                                    {magicStatus === "sending" ? "Envoi..." : "Recevoir un lien"}
                                </button>
                                {magicStatus === "error" && (
                                    <p className="magic-error">Une erreur est survenue, réessayez.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}