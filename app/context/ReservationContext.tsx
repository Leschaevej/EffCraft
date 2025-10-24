"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type ReservationContextType = {
    reservedProducts: Set<string>;
    availableProducts: Set<string>; // Produits explicitement marqués comme disponibles par SSE
    isProductReserved: (productId: string) => boolean;
    currentUserId: string | null; // ID de l'utilisateur actuel
};

const ReservationContext = createContext<ReservationContextType>({
    reservedProducts: new Set(),
    availableProducts: new Set(),
    isProductReserved: () => false,
    currentUserId: null,
});

export function ReservationProvider({ children }: { children: React.ReactNode }) {
    const [reservedProducts, setReservedProducts] = useState<Set<string>>(new Set());
    const [availableProducts, setAvailableProducts] = useState<Set<string>>(new Set());
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const { data: session } = useSession();

    // Récupérer l'ID de l'utilisateur actuel une seule fois
    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (!session?.user) {
                setCurrentUserId(null);
                return;
            }
            try {
                const res = await fetch("/api/user?type=me");
                if (res.ok) {
                    const data = await res.json();
                    setCurrentUserId(data.userId);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération de l'utilisateur:", error);
            }
        };
        fetchCurrentUser();
    }, [session]);

    useEffect(() => {
        // Une seule connexion SSE pour toute l'application
        const eventSource = new EventSource("/api/cart");

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "product_reserved") {
                setReservedProducts(prev => {
                    const newSet = new Set(prev);
                    newSet.add(data.data.productId);
                    return newSet;
                });
                // Retirer des disponibles si présent
                setAvailableProducts(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(data.data.productId);
                    return newSet;
                });
            } else if (data.type === "product_available") {
                setReservedProducts(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(data.data.productId);
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
            // Erreur SSE silencieuse
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const isProductReserved = (productId: string) => {
        return reservedProducts.has(productId);
    };

    return (
        <ReservationContext.Provider value={{ reservedProducts, availableProducts, isProductReserved, currentUserId }}>
            {children}
        </ReservationContext.Provider>
    );
}

export function useReservation() {
    return useContext(ReservationContext);
}
