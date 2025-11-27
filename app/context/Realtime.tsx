"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Pusher from 'pusher-js';

type RealtimeContextType = {
    reservedProducts: Set<string>;
    availableProducts: Set<string>;
    isProductReserved: (productId: string) => boolean;
    currentUserId: string | null;
    version: number; // Force re-render
};

const RealtimeContext = createContext<RealtimeContextType>({
    reservedProducts: new Set(),
    availableProducts: new Set(),
    isProductReserved: () => false,
    currentUserId: null,
    version: 0,
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
    const [reservedProducts, setReservedProducts] = useState<Set<string>>(new Set());
    const [availableProducts, setAvailableProducts] = useState<Set<string>>(new Set());
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
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
                console.error("Error fetching initial data:", error);
            }
        };

        fetchInitialData();
    }, [session]);

    useEffect(() => {
        const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
            cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
            forceTLS: true,
            disableStats: true,
            enabledTransports: ['ws', 'wss'],
            activityTimeout: 120000,
            pongTimeout: 30000
        });

        const channel = pusher.subscribe('effcraft-channel');

        channel.bind('product_reserved', (data: { productId: string }) => {
            setReservedProducts(prev => {
                const newSet = new Set(prev);
                newSet.add(data.productId);
                return newSet;
            });
            setAvailableProducts(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.productId);
                return newSet;
            });
            setVersion(v => v + 1); // Force re-render
            window.dispatchEvent(new CustomEvent("cart-update", {
                detail: { type: "product_reserved", productId: data.productId }
            }));
        });

        channel.bind('product_available', (data: { productId: string }) => {
            setReservedProducts(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.productId);
                return newSet;
            });
            setAvailableProducts(prev => {
                const newSet = new Set(prev);
                newSet.add(data.productId);
                return newSet;
            });
            setVersion(v => v + 1); // Force re-render
            window.dispatchEvent(new CustomEvent("cart-update", {
                detail: { type: "product_available", productId: data.productId }
            }));
        });

        channel.bind('product_deleted', (data: { productId: string }) => {
            console.log('[Pusher] product_deleted reçu:', data);
            setReservedProducts(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.productId);
                return newSet;
            });
            setAvailableProducts(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.productId);
                return newSet;
            });
            window.dispatchEvent(new CustomEvent("cart-update", {
                detail: { type: "product_deleted", productId: data.productId }
            }));
        });

        channel.bind('product_created', (data: { productId: string }) => {
            console.log('[Pusher] product_created reçu:', data);
            window.dispatchEvent(new CustomEvent("cart-update", {
                detail: { type: "product_created", productId: data.productId }
            }));
        });

        channel.bind('order_created', (data: { orderId: string }) => {
            window.dispatchEvent(new CustomEvent("cart-update", {
                detail: { type: "order_created", orderId: data.orderId }
            }));
        });

        channel.bind('order_deleted', (data: { orderId: string }) => {
            window.dispatchEvent(new CustomEvent("cart-update", {
                detail: { type: "order_deleted", orderId: data.orderId }
            }));
        });

        channel.bind('order_status_updated', (data: { orderId: string; status: string }) => {
            window.dispatchEvent(new CustomEvent("cart-update", {
                detail: { type: "order_status_updated", data: { orderId: data.orderId, status: data.status } }
            }));
        });

        return () => {
            channel.unbind_all();
            channel.unsubscribe();
            pusher.disconnect();
        };
    }, []);

    const isProductReserved = useCallback((productId: string) => {
        return reservedProducts.has(productId);
    }, [reservedProducts]);

    return (
        <RealtimeContext.Provider value={{ reservedProducts, availableProducts, isProductReserved, currentUserId, version }}>
            {children}
        </RealtimeContext.Provider>
    );
}

export function useRealtime() {
    return useContext(RealtimeContext);
}
