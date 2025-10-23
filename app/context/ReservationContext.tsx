"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ReservationContextType = {
    reservedProducts: Set<string>;
    availableProducts: Set<string>; // Produits explicitement marqués comme disponibles par SSE
    isProductReserved: (productId: string) => boolean;
};

const ReservationContext = createContext<ReservationContextType>({
    reservedProducts: new Set(),
    availableProducts: new Set(),
    isProductReserved: () => false,
});

export function ReservationProvider({ children }: { children: React.ReactNode }) {
    const [reservedProducts, setReservedProducts] = useState<Set<string>>(new Set());
    const [availableProducts, setAvailableProducts] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Une seule connexion SSE pour toute l'application
        const eventSource = new EventSource("/api/cart");

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("SSE Event reçu:", data);

            if (data.type === "product_reserved") {
                console.log("Produit réservé:", data.data.productId);
                setReservedProducts(prev => {
                    const newSet = new Set(prev);
                    newSet.add(data.data.productId);
                    console.log("Produits réservés:", Array.from(newSet));
                    return newSet;
                });
                // Retirer des disponibles si présent
                setAvailableProducts(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(data.data.productId);
                    return newSet;
                });
            } else if (data.type === "product_available") {
                console.log("Produit disponible:", data.data.productId);
                setReservedProducts(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(data.data.productId);
                    console.log("Produits réservés:", Array.from(newSet));
                    return newSet;
                });
                // Marquer explicitement comme disponible
                setAvailableProducts(prev => {
                    const newSet = new Set(prev);
                    newSet.add(data.data.productId);
                    return newSet;
                });
            }
        };

        eventSource.onerror = () => {
            console.error("Erreur SSE");
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const isProductReserved = (productId: string) => {
        return reservedProducts.has(productId);
    };

    return (
        <ReservationContext.Provider value={{ reservedProducts, availableProducts, isProductReserved }}>
            {children}
        </ReservationContext.Provider>
    );
}

export function useReservation() {
    return useContext(ReservationContext);
}
