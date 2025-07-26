"use client";

import React, { useEffect, useState, useRef } from "react";
import Card from "../card/Card";
import "./DeleteForm.scss";

interface Product {
  _id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  images: string[];
}

export default function DeleteForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error("Erreur lors du chargement");
        return res.json();
      })
      .then((data) => {
        setProducts(data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        confirmingId &&
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setConfirmingId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [confirmingId]);

  const handleDeleteRequest = (id: string) => {
    setConfirmingId(id);
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression");

      setProducts((prev) => prev.filter((p) => p._id !== id));
      setConfirmingId(null);
    } catch (err) {
      alert("Impossible de supprimer : " + (err instanceof Error ? err.message : "Erreur"));
    }
  };

  if (loading) return <p>Chargement des produits...</p>;
  if (error) return <p>Erreur : {error}</p>;

  return (
    <div className="deleteForm">
      <div className="grid">
        {products.length === 0 && <p>Aucun produit disponible.</p>}
        {products.map((product) => (
          <div
            key={product._id}
            className={`card-wrapper ${confirmingId === product._id ? "confirming" : ""}`}
            ref={confirmingId === product._id ? wrapperRef : null}
          >
            {confirmingId === product._id ? (
              <div className="confirm-box">
                <p>Confirmer la suppression ?</p>
                <div className="buttons">
                  <button className="confirm" onClick={() => handleConfirmDelete(product._id)}>
                    Valider
                  </button>
                  <button className="cancel" onClick={() => setConfirmingId(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Card bijou={product} clickable={false} />
                <button
                  className="delete-button"
                  aria-label={`Supprimer ${product.name}`}
                  onClick={() => handleDeleteRequest(product._id)}
                  type="button"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}