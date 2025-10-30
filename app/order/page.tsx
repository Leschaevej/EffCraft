"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
import { FaCheck, FaBoxOpen, FaWarehouse, FaTruck, FaTruckMoving, FaHome } from "react-icons/fa";
import "./page.scss";

interface Product {
    _id: string;
    name: string;
    images: string[];
    price: number;
}

interface Order {
    _id: string;
    products: Product[];
    totalPrice: number;
    shippingData: any;
    shippingMethod: any;
    createdAt: string;
    status: string;
    boxtalStatus?: string;
    trackingNumber?: string;
}

const TRACKING_STEPS = [
    { label: "Commande confirmée", icon: <FaCheck /> },
    { label: "En cours de préparation", icon: <FaBoxOpen /> },
    { label: "Remis au transporteur", icon: <FaWarehouse /> },
    { label: "En transit", icon: <FaTruck /> },
    { label: "En livraison", icon: <FaTruckMoving /> },
    { label: "Livré", icon: <FaHome /> }
];

const STATUS_STEPS: { [key: string]: number } = {
    paid: 1,
    preparing: 2,
    ready: 3,
    in_transit: 4,
    out_for_delivery: 5,
    delivered: 6
};

export default function OrderPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [currentOrders, setCurrentOrders] = useState<Order[]>([]);
    const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [trackingView, setTrackingView] = useState<Order | null>(null);

    useEffect(() => {
        if (authStatus === "loading") return;
        if (!session) {
            router.replace("/");
        }
    }, [session, authStatus, router]);

    useEffect(() => {
        if (session?.user?.email) {
            fetchOrders();
        }
    }, [session]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Récupérer les commandes en cours
            const currentResponse = await fetch(`/api/order/user?statuses=paid,preparing,ready,in_transit,out_for_delivery,delivered`);
            if (currentResponse.ok) {
                const data = await currentResponse.json();

                // Synchroniser les statuts Boxtal pour chaque commande qui a un boxtalShipmentId
                const ordersWithSync = await Promise.all(
                    data.orders.map(async (order: Order) => {
                        if (order.boxtalStatus) {
                            try {
                                const syncResponse = await fetch(`/api/shipping?action=sync-status&orderId=${order._id}`);
                                if (syncResponse.ok) {
                                    const syncData = await syncResponse.json();
                                    return { ...order, status: syncData.status, boxtalStatus: syncData.boxtalStatus };
                                }
                            } catch (error) {
                                console.error("Erreur sync:", error);
                            }
                        }
                        return order;
                    })
                );

                setCurrentOrders(ordersWithSync);
            }

            // Récupérer l'historique
            const historyResponse = await fetch(`/api/order/user?statuses=delivered,cancelled,returned`);
            if (historyResponse.ok) {
                const data = await historyResponse.json();
                setHistoryOrders(data.orders);
            }
        } catch (error) {
            console.error("Erreur chargement commandes:", error);
        } finally {
            setLoading(false);
        }
    };

    const getTrackingStep = (order: Order): number => STATUS_STEPS[order.status] || 1;

    if (authStatus === "loading" || !session) {
        return <p>Chargement...</p>;
    }

    return (
        <main className="order">
            <section className="suivi">
                {trackingView ? (
                    <div className="conteneur">
                        <div className="tracking">
                            <h2 className={nothingYouCouldDo.className}>Suivi</h2>
                            <div className="steps">
                                {TRACKING_STEPS.map((step, index) => {
                                    const currentStep = getTrackingStep(trackingView);
                                    return (
                                        <div
                                            key={index}
                                            className={`step ${index + 1 <= currentStep ? "active" : ""}`}
                                        >
                                            <div className="icon">{step.icon}</div>
                                            <p className="label">{step.label}</p>
                                            {index < TRACKING_STEPS.length - 1 && <div className="line"></div>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="details-wrapper">
                                <div className="infos">
                                    <h3>Détails de la commande</h3>
                                    <p>Date : {new Date(trackingView.createdAt).toLocaleDateString()}</p>
                                    <p>Total : {trackingView.totalPrice}€</p>
                                    <p>Mode de livraison : {trackingView.shippingMethod?.name}</p>
                                    <p>
                                        {trackingView.trackingNumber
                                            ? `N° de suivi : ${trackingView.trackingNumber}`
                                            : "En attente du numéro de suivi"}
                                    </p>
                                </div>
                                <div className="products">
                                    <h3>Produits</h3>
                                    <div className="products-list">
                                        {trackingView.products.map((product) => (
                                            <div key={product._id} className="product">
                                                <div className="image">
                                                    {product.images && product.images.length > 0 && (
                                                        <img src={product.images[0]} alt={product.name} />
                                                    )}
                                                </div>
                                                <p className="name">{product.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button className="back" onClick={() => setTrackingView(null)}>
                                Retour
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="conteneur">
                        <h2 className={nothingYouCouldDo.className}>Commandes</h2>
                        {loading ? (
                            <p className="loading">Chargement...</p>
                        ) : currentOrders.length === 0 ? (
                            <p className="empty">Aucune commande</p>
                        ) : (
                            <div className="list">
                                {currentOrders.map((order) => (
                                    <div key={order._id} className="item">
                                        <div className="info">
                                            <div className="preview">
                                                {order.products[0]?.images && order.products[0].images.length > 0 && (
                                                    <img src={order.products[0].images[0]} alt={order.products[0].name} />
                                                )}
                                            </div>
                                            <div className="details">
                                                <p>{new Date(order.createdAt).toLocaleDateString()}</p>
                                                <p className="total">{order.totalPrice}€</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setTrackingView(order)}>
                                            Suivre mon colis
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>
            <section className="historique">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Historique</h2>
                    {loading ? (
                        <p className="loading">Chargement...</p>
                    ) : historyOrders.length === 0 ? (
                        <p className="empty">Aucune commande</p>
                    ) : (
                        <div className="list">
                            {historyOrders.map((order) => (
                                <div key={order._id} className="item">
                                    <div className="info">
                                        <div className="preview">
                                            {order.products[0]?.images && order.products[0].images.length > 0 && (
                                                <img src={order.products[0].images[0]} alt={order.products[0].name} />
                                            )}
                                        </div>
                                        <div className="details">
                                            <p>{new Date(order.createdAt).toLocaleDateString()}</p>
                                            <p className="total">{order.totalPrice}€</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
