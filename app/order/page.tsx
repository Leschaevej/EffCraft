"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
import { FaCheck, FaBoxOpen, FaWarehouse, FaTruck, FaTruckMoving, FaHome } from "react-icons/fa";
import "./page.scss";
import { useUserOrders } from "../hooks/useOrders";

interface Product {
    _id: string;
    name: string;
    images: string[];
    price: number;
}
interface Order {
    _id: string;
    products: Product[];
    shippingData: {
        trackingNumber?: string;
        boxtalShipmentId?: string;
        shippingMethod?: any;
        [key: string]: any;
    };
    order: {
        totalPrice: number;
        status: string;
        createdAt: Date;
        deliveredAt?: Date;
        refundReason?: string;
        cancelledAt?: Date;
        returnedAt?: Date;
        preparingAt?: Date;
        readyAt?: Date;
    };
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
const STATUS_LABELS: { [key: string]: string } = {
    paid: "Commande confirmée",
    preparing: "En préparation",
    ready: "Prêt à être récupéré",
    in_transit: "En transit",
    out_for_delivery: "En cours de livraison",
    delivered: "Livré",
    cancelled: "Remboursé",
    return_requested: "Retour demandé",
    returned: "Remboursé"
};

const getTrackingUrl = (trackingNumber: string, operator?: string): string | null => {
    if (!trackingNumber || !operator) return null;

    switch (operator) {
        case "MONR": // Mondial Relay
            return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${trackingNumber}`;
        case "SOGP": // Relais Colis
            return `https://www.relaiscolis.com/suivi/?code=${trackingNumber}`;
        case "COPA": // Colissimo
            return `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber}`;
        case "CHRP": // Chronopost
            return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${trackingNumber}`;
        default:
            return null;
    }
};
export default function OrderPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [orderView, setOrderView] = useState<"pending" | "history">("pending");
    const { orders: swrOrders, isLoading: swrLoading, mutate } = useUserOrders(orderView);
    const [orders, setOrders] = useState<Order[]>([]);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // Synchroniser les données SWR avec le state local
    useEffect(() => {
        if (!swrLoading) {
            setOrders(swrOrders);
        }
    }, [swrOrders, swrLoading]);

    useEffect(() => {
        if (authStatus === "loading") return;
        if (!session) {
            router.replace("/");
        }
    }, [session, authStatus, router]);

    useEffect(() => {
        if (session?.user?.email) {
            const handleOrderUpdate = (event: Event) => {
                const customEvent = event as CustomEvent;
                if (customEvent.detail?.type === "order_status_updated" && customEvent.detail?.data) {
                    const { orderId, status } = customEvent.detail.data;
                    const pendingStatuses = ["paid", "preparing", "ready", "in_transit", "out_for_delivery", "return_requested"];
                    const historyStatuses = ["delivered", "cancelled", "returned"];
                    const shouldBeInCurrentView = orderView === "pending"
                        ? pendingStatuses.includes(status)
                        : historyStatuses.includes(status);
                    if (shouldBeInCurrentView) {
                        setOrders(prev => prev.map(order =>
                            order._id === orderId ? { ...order, status } : order
                        ));
                    } else {
                        setOrders(prev => prev.filter(order => order._id !== orderId));
                    }
                } else if (customEvent.detail?.type === "order_deleted") {
                    mutate();
                }
            };
            window.addEventListener("cart-update", handleOrderUpdate);
            return () => {
                window.removeEventListener("cart-update", handleOrderUpdate);
            };
        }
    }, [session, orderView, mutate]);
    const getTrackingStep = (order: Order): number => STATUS_STEPS[order.order.status] || 1;
    const getStatusIcon = (status: string) => {
        const iconMap: { [key: string]: React.ReactNode } = {
            paid: <FaCheck />,
            preparing: <FaBoxOpen />,
            ready: <FaWarehouse />,
            in_transit: <FaTruck />,
            out_for_delivery: <FaTruckMoving />,
            delivered: <FaHome />,
            cancelled: <FaCheck />,
            returned: <FaCheck />
        };
        return iconMap[status] || <FaCheck />;
    };
    if (authStatus === "loading" || !session) {
        return <p>Chargement...</p>;
    }
    return (
        <main className="order">
            <section className="suivi">
                <div className="tabs">
                    <button
                        className={orderView === "pending" ? "active" : ""}
                        onClick={() => setOrderView("pending")}
                    >
                        Commande
                    </button>
                    <button
                        className={orderView === "history" ? "active" : ""}
                        onClick={() => setOrderView("history")}
                    >
                        Historique
                    </button>
                </div>
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>
                        {orderView === "pending" ? "Commande" : "Historique"}
                    </h2>
                    {swrLoading ? (
                        <p className="loading">Chargement des commandes...</p>
                    ) : orders.length === 0 ? (
                        <p className="empty">Aucune commande</p>
                    ) : (
                        <div className="list">
                            {orders.map((order) => (
                                <div key={order._id} className={`item ${expandedOrderId === order._id ? "expanded" : ""}`}>
                                    <div className="head">
                                        <div className="info">
                                            <div className="preview">
                                                {order.products[0]?.images && order.products[0].images.length > 0 && (
                                                    <img src={order.products[0].images[0]} alt={order.products[0].name} />
                                                )}
                                            </div>
                                            <p>{new Date(order.order.createdAt).toLocaleDateString()}</p>
                                            <p className="total">{order.order.totalPrice.toFixed(2)}€</p>
                                            <div className="status">
                                                <div className="icon">
                                                    {getStatusIcon(order.order.status)}
                                                </div>
                                                <p className="label">{STATUS_LABELS[order.order.status] || order.order.status}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}>
                                            {expandedOrderId === order._id ? "Fermer" : "Details"}
                                        </button>
                                    </div>
                                    {expandedOrderId === order._id && (
                                        <div className="details">
                                            {orderView === "pending" && (
                                                <div className="tracking">
                                                    {TRACKING_STEPS.map((step, index) => {
                                                        const currentStep = getTrackingStep(order);
                                                        const isActive = index + 1 <= currentStep;
                                                        const isConnectorActive = index + 1 <= currentStep;
                                                        return (
                                                            <React.Fragment key={index}>
                                                                <div className={`step ${isActive ? "active" : ""}`}>
                                                                    <div className="icon">{step.icon}</div>
                                                                    <p className="label">{step.label}</p>
                                                                </div>
                                                                {index < TRACKING_STEPS.length - 1 && (
                                                                    <div className={`connector ${isConnectorActive ? "active" : ""}`}></div>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className="content">
                                                <div className="infos">
                                                    <div className="info">
                                                        <h3>Informations de commande</h3>
                                                        <p>Date de commande : {new Date(order.order.createdAt).toLocaleDateString()}</p>
                                                        <p>Total : {order.order.totalPrice.toFixed(2)}€</p>
                                                        {order.order.refundReason && (
                                                            <>
                                                                <p>Motif de remboursement : {order.order.refundReason}</p>
                                                                <p>Date de remboursement : {new Date(order.order.cancelledAt || order.order.returnedAt || order.order.createdAt).toLocaleDateString()}</p>
                                                            </>
                                                        )}
                                                        {!order.order.refundReason && (
                                                            <>
                                                                <p>Mode de livraison : {order.shippingData.shippingMethod?.name}</p>
                                                                <p>
                                                                    N° de suivi : {order.shippingData.trackingNumber ? (
                                                                        (() => {
                                                                            const trackingUrl = getTrackingUrl(order.shippingData.trackingNumber, order.shippingData.shippingMethod?.operator);
                                                                            return trackingUrl ? (
                                                                                <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mainColor)', textDecoration: 'underline' }}>
                                                                                    {order.shippingData.trackingNumber}
                                                                                </a>
                                                                            ) : order.shippingData.trackingNumber;
                                                                        })()
                                                                    ) : "En attente"}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                    {order.shippingData && (
                                                        <div className="shipping-container">
                                                            <div className="info">
                                                                <h3>Livraison</h3>
                                                                <p>{order.shippingData.nom || ''} {order.shippingData.prenom || ''}</p>
                                                                <p>{order.shippingData.rue || ''}</p>
                                                                <p>{order.shippingData.codePostal || ''} {order.shippingData.ville || ''}</p>
                                                            </div>
                                                            {order.shippingData.shippingMethod?.relayPoint && (
                                                                <div className="info">
                                                                    <h3>Point relais</h3>
                                                                    <p>{order.shippingData.shippingMethod.relayPoint.name} </p>
                                                                    <p>{order.shippingData.shippingMethod.relayPoint.address}</p>
                                                                    <p>{order.shippingData.shippingMethod.relayPoint.zipcode} {order.shippingData.shippingMethod.relayPoint.city}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="actions">
                                                        <button className="invoice">Facture</button>
                                                        {orderView === "pending" && (
                                                            <>
                                                                {["paid", "preparing"].includes(order.order.status) && (
                                                                    <button className="cancel">
                                                                        Demander annulation
                                                                    </button>
                                                                )}
                                                                {["ready", "in_transit", "out_for_delivery", "delivered"].includes(order.order.status) && (
                                                                    <button className="return">
                                                                        Demander un retour
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        {orderView === "history" && order.order.status === "delivered" && order.order.deliveredAt && (
                                                            (() => {
                                                                const deliveredDate = new Date(order.order.deliveredAt);
                                                                const now = new Date();
                                                                const diffTime = now.getTime() - deliveredDate.getTime();
                                                                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                                                                return diffDays <= 14 ? (
                                                                    <button className="return">
                                                                        Demander un retour
                                                                    </button>
                                                                ) : null;
                                                            })()
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="products">
                                                    {order.products.map((product) => (
                                                        <div key={product._id} className="product">
                                                            {product.images && product.images.length > 0 && (
                                                                <img src={product.images[0]} alt={product.name} />
                                                            )}
                                                            <p className="name">{product.name}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}