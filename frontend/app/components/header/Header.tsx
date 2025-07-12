"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaShoppingBag, FaHeart, FaBars, FaUser } from "react-icons/fa";
import "./Header.scss";

export default function Header() {
  const pathname = usePathname();

  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <header className="header">
        <h1 className="logo">
            <Link href="/" onClick={handleLogoClick}>
            <img src="/logo.webp" alt="Logo Eff Craft" />
            </Link>
        </h1>
        <nav>
            <FaUser className="icon" />
            <FaHeart className="icon" />
            <FaShoppingBag className="icon" />
            <FaBars className="icon" />
        </nav>
    </header>

  );
}
