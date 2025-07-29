"use client";

import React, { useState, useEffect } from "react";
import "./Card.scss";
import Link from "next/link";
import { useSession } from "next-auth/react";
import ArrowButton from "../../components/Arrow";

type Bijou = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category?: string;
  images: string[];
};

type CardProps = {
  bijou: Bijou;
  clickable?: boolean;
  showPrice?: boolean;
  showName?: boolean;
  imageReplacement?: React.ReactNode;
  initialIsFavori?: boolean;
  showFavori?: boolean;
};

const HeartOutline = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const HeartFill = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export default function Card({
  bijou,
  clickable = true,
  showPrice = true,
  showName = true,
  imageReplacement,
  initialIsFavori = false,
  showFavori = true,
}: CardProps) {
  const { data: session } = useSession();
  const [isFavori, setIsFavori] = useState(initialIsFavori);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setIsFavori(initialIsFavori);
  }, [initialIsFavori]);

  const toggleFavori = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!session?.user) {
      sessionStorage.setItem("pendingFavori", bijou._id);
      document.dispatchEvent(new Event("open-login-panel"));
      return;
    }
    setLoading(true);
    const method = isFavori ? "DELETE" : "POST";
    try {
      const res = await fetch("/api/user/favorites", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: bijou._id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la requête");
      }
      setIsFavori(!isFavori);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const nextImage = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setCurrentIndex((prev) => (prev + 1) % bijou.images.length);
};

const prevImage = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setCurrentIndex((prev) => (prev === 0 ? bijou.images.length - 1 : prev - 1));
};

  const content = (
    <div className="card">
      <div className="card-image">
        {imageReplacement ? (
          imageReplacement
        ) : (
          <>
            <ArrowButton direction="left" onClick={prevImage} />
            <img src={bijou.images?.[currentIndex] ?? "/default.jpg"} alt={bijou.name} />
            <ArrowButton direction="right" onClick={nextImage} />
          </>
        )}
        {showFavori && (
          <button
            className={`favori ${isFavori ? "favori-active" : ""}`}
            onClick={toggleFavori}
            aria-label={isFavori ? "Retirer des favoris" : "Ajouter aux favoris"}
            disabled={loading}
          >
            {isFavori ? <HeartFill /> : <HeartOutline />}
          </button>
        )}
      </div>
      {showName && <h3>{bijou.name}</h3>}
      {showPrice && <p className="prix">{bijou.price} €</p>}
    </div>
  );

  return clickable ? <Link href={`/products/${bijou._id}`}>{content}</Link> : content;
}