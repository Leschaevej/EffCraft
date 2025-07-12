"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FaShoppingBag, FaHeart, FaBars, FaUser } from "react-icons/fa";
import "./Header.scss";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSectionClick = (sectionId: string) => {
    setIsMenuOpen(false);
    if (pathname === "/") {
      const section = document.getElementById(sectionId);
      section?.scrollIntoView({ behavior: "smooth" });
    } else {
      sessionStorage.setItem("scrollToId", sectionId);
      router.push("/");
    }
  };

  return (
    <>
      <header className="header">
        <h1 className="logo">
          <a href="/" onClick={handleLogoClick}>
            <img src="/logo.webp" alt="Logo Eff Craft" />
          </a>
        </h1>
        <nav>
          <FaUser className="icon" onClick={() => setIsLoginOpen(!isLoginOpen)} />
          <FaHeart className="icon" />
          <FaShoppingBag className="icon" />
          <FaBars className="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} />
        </nav>
      </header>

      {(isMenuOpen || isLoginOpen) && (
        <div
          className="overlay"
          onClick={() => {
            setIsMenuOpen(false);
            setIsLoginOpen(false);
          }}
        />
      )}

      {/* Menu glissant */}
      <div className={`menu ${isMenuOpen ? "open" : ""}`}>
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
          <a href="https://www.instagram.com/tonprofil" target="_blank" rel="noopener noreferrer">
            <img src="/instagram.webp" alt="Instagram" />
          </a>
          <a href="https://www.tiktok.com/@tonprofil" target="_blank" rel="noopener noreferrer">
            <img src="/tiktok.webp" alt="TikTok" />
          </a>
        </div>
      </div>

      {/* Login glissant */}
      <div className={`login ${isLoginOpen ? "open" : ""}`}>
        <button className="googleButton" onClick={() => alert("Connexion Google")}>
          Se connecter avec Google
        </button>
        <button className="facebookButton" onClick={() => alert("Connexion Facebook")}>
          Se connecter avec Facebook
        </button>
        <button className="appleButton" onClick={() => alert("Connexion Apple")}>
          Se connecter avec Apple
        </button>
      </div>
    </>
  );
}
