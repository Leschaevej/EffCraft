"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type RealtimeContextType = {
    reservedProducts: Set<string>;
    availableProducts: Set<string>;
    isProductReserved: (productId: string) => boolean;
    currentUserId: string | null;
};
const RealtimeContext = createContext<RealtimeContextType>({
    reservedProducts: new Set(),
    availableProducts: new Set(),
    isProductReserved: () => false,
    currentUserId: null,
});
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
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
                } else if (data.type === "product_deleted") {
                    setReservedProducts(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(data.data.productId);
                        return newSet;
                    });
                    setAvailableProducts(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(data.data.productId);
                        return newSet;
                    });
                    window.dispatchEvent(new CustomEvent("cart-update", {
                        detail: { type: "product_deleted", productId: data.data.productId }
                    }));
                } else if (data.type === "product_created") {
                    window.dispatchEvent(new CustomEvent("cart-update", {
                        detail: { type: "product_created", productId: data.data.productId }
                    }));
                } else if (data.type === "order_created") {
                    window.dispatchEvent(new CustomEvent("cart-update", {
                        detail: { type: "order_created", orderId: data.data.orderId }
                    }));
                } else if (data.type === "order_deleted") {
                    window.dispatchEvent(new CustomEvent("cart-update", {
                        detail: { type: "order_deleted", orderId: data.data.orderId }
                    }));
                } else if (data.type === "order_status_updated") {
                    window.dispatchEvent(new CustomEvent("cart-update", {
                        detail: { type: "order_status_updated", data: { orderId: data.data.orderId, status: data.data.status } }
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
        <RealtimeContext.Provider value={{ reservedProducts, availableProducts, isProductReserved, currentUserId }}>
            {children}
        </RealtimeContext.Provider>
    );
}
export function useRealtime() {
    return useContext(RealtimeContext);
}