import React from "react";
import { FaShoppingBag, FaHeart, FaBars, FaUser } from "react-icons/fa";
import "./Header.scss";

export default function Header() {
  return (
    <header className="header">
      <div className="logo">
        <img src="/logo.webp" alt="Logo Eff Craft" />
      </div>
      <nav>
        <FaUser className="icon" />
        <FaHeart className="icon" />
        <FaShoppingBag className="icon" />
        <FaBars className="icon" />
      </nav>
    </header>
  );
}
