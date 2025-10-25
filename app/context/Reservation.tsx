"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type ReservationContextType = {
    reservedProducts: Set<string>;
    availableProducts: Set<string>;
    isProductReserved: (productId: string) => boolean;
    currentUserId: string | null;
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
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!session?.user) {
                setCurrentUserId(null);
                return;
            }
            try {
                const userRes = await fetch("/api/user?type=me");
                if (userRes.ok) {
                    const userData = await userRes.json();
                    setCurrentUserId(userData.userId);
                }
                const productsRes = await fetch("/api/products");
                if (productsRes.ok) {
                    const products = await productsRes.json();
                    const initialReserved = new Set<string>();
                    products.forEach((product: any) => {
                        if (product.status === "reserved") {
                            initialReserved.add(product._id);
                        }
                    });
                    if (initialReserved.size > 0) {
                        setReservedProducts(initialReserved);
                    }
                }
            } catch (error) {
                // Erreur silencieuse
            }
        };
        fetchInitialData();
    }, [session]);
    useEffect(() => {
        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;
        let isMounted = true;
        let initialConnectionAttempted = false;
        const connectSSE = () => {
            if (!isMounted) return;
            if (!initialConnectionAttempted) {
                initialConnectionAttempted = true;
                fetch("/api/cart?warmup=true").catch(() => {});
                setTimeout(() => {
                    if (!isMounted) return;
                    createEventSource();
                }, 500);
                return;
            }
            createEventSource();
        };
        const createEventSource = () => {
            if (!isMounted) return;
            eventSource = new EventSource("/api/cart");
            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "product_reserved") {
                    setReservedProducts(prev => {
                        const newSet = new Set(prev);
                        newSet.add(data.data.productId);
                        return newSet;
                    });
                    setAvailableProducts(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(data.data.productId);
                        return newSet;
                    });
                    window.dispatchEvent(new CustomEvent("cart-update", {
                        detail: { type: "product_reserved", productId: data.data.productId }
                    }));
                } else if (data.type === "product_available") {
                    setReservedProducts(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(data.data.productId);
                        return newSet;
                    });
                    setAvailableProducts(prev => {
                        const newSet = new Set(prev);
                        newSet.add(data.data.productId);
                        return newSet;
                    });
                    window.dispatchEvent(new CustomEvent("cart-update", {
                        detail: { type: "product_available", productId: data.data.productId }
                    }));
                }
            };
            eventSource.onerror = () => {
                eventSource?.close();
                if (isMounted) {
                    reconnectTimeout = setTimeout(() => {
                        connectSSE();
                    }, 3000);
                }
            };
        };
        connectSSE();
        return () => {
            isMounted = false;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (eventSource) eventSource.close();
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