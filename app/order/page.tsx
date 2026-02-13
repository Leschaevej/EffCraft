"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
import { FaCheck, FaBoxOpen, FaTruck, FaHome, FaHourglassHalf } from "react-icons/fa";
import "./page.scss";
import { useUserOrders } from "../hooks/useOrders";
interface Product {
    _id?: string;
    name: string;
    images?: string[];
    image?: string;
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
    { label: "Confirmé", icon: <FaCheck /> },
    { label: "En préparation", icon: <FaBoxOpen /> },
    { label: "Livraison", icon: <FaTruck /> },
    { label: "Livré", icon: <FaHome /> }
];
const RETURN_TRACKING_STEPS = [
    { label: "Retour confirmé", icon: <FaCheck /> },
    { label: "Livraison", icon: <FaTruck /> },
    { label: "Livré", icon: <FaHome /> }
];
const STATUS_STEPS: { [key: string]: number } = {
    paid: 1,
    preparing: 2,
    in_transit: 3,
    delivered: 4,
    cancel_requested: 1,
    return_requested: 1,
    return_in_transit: 2,
    return_delivered: 3
};
const STATUS_LABELS: { [key: string]: string } = {
    paid: "Confirmé",
    preparing: "En préparation",
    in_transit: "Livraison",
    delivered: "Livré",
    cancelled: "Remboursé",
    cancel_requested: "Demande en cours",
    return_requested: "Retour confirmé",
    return_in_transit: "En transit",
    return_delivered: "Livré",
    returned: "Remboursé"
};
const getShippingMethodName = (operator?: string, serviceCode?: string): string => {
    if (!operator) return "Non défini";
    const names: { [key: string]: string } = {
        "MONR": "Mondial Relay",
        "SOGP": "Relais Colis",
        "POFR": "Colissimo",
        "CHRP": "Chronopost"
    };
    return names[operator] || operator;
};
const getTrackingUrl = (trackingNumber: string, operator?: string): string | null => {
    if (!trackingNumber || !operator) return null;

    switch (operator) {
        case "MONR":
            return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${trackingNumber}`;
        case "SOGP":
            return `https://www.relaiscolis.com/suivi/?code=${trackingNumber}`;
        case "POFR":
            return `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber}`;
        case "CHRP":
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
    const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelMessage, setCancelMessage] = useState("");
    const [cancelStatus, setCancelStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
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
                    const pendingStatuses = ["paid", "preparing", "in_transit", "cancel_requested", "return_requested", "return_in_transit"];
                    const historyStatuses = ["delivered", "cancelled", "returned", "return_delivered"];
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
    const getDisplayStatus = (order: Order): string => {
        return order.order.status;
    };
    const getTrackingStep = (order: Order): number => STATUS_STEPS[getDisplayStatus(order)] || 1;
    const getStatusIcon = (status: string) => {
        const iconMap: { [key: string]: React.ReactNode } = {
            paid: <FaCheck />,
            preparing: <FaBoxOpen />,
            in_transit: <FaTruck />,
            delivered: <FaHome />,
            cancelled: <FaCheck />,
            cancel_requested: <FaHourglassHalf />,
            returned: <FaCheck />,
            return_requested: <FaCheck />,
            return_in_transit: <FaTruck />,
            return_delivered: <FaHome />
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
                                                {(order.products[0]?.image || order.products[0]?.images?.[0]) && (
                                                    <img src={order.products[0].image || order.products[0].images?.[0]} alt={order.products[0].name} />
                                                )}
                                            </div>
                                            <p>{new Date(order.order.createdAt).toLocaleDateString()}</p>
                                            <p className="total">{order.order.totalPrice.toFixed(2)}€</p>
                                            <div className="status">
                                                <div className="icon">
                                                    {getStatusIcon(getDisplayStatus(order))}
                                                </div>
                                                <p className="label">{STATUS_LABELS[getDisplayStatus(order)] || getDisplayStatus(order)}</p>
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
                                                    {(() => {
                                                        const isReturn = order.order.status.startsWith("return_");
                                                        const steps = isReturn ? RETURN_TRACKING_STEPS : TRACKING_STEPS;
                                                        return steps.map((step, index) => {
                                                            const currentStep = getTrackingStep(order);
                                                            const isActive = index + 1 <= currentStep;
                                                            const isConnectorActive = index + 1 <= currentStep;
                                                            return (
                                                                <React.Fragment key={index}>
                                                                    <div className={`step ${isActive ? "active" : ""}`}>
                                                                        <div className="icon">{step.icon}</div>
                                                                        <p className="label">{step.label}</p>
                                                                    </div>
                                                                    {index < steps.length - 1 && (
                                                                        <div className={`connector ${isConnectorActive ? "active" : ""}`}></div>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        });
                                                    })()}
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
                                                                <p>Mode de livraison : {getShippingMethodName(order.shippingData.shippingMethod?.operator, order.shippingData.shippingMethod?.serviceCode)}</p>
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
                                                        <button className="invoice" onClick={() => window.open(`/api/invoice?orderId=${order._id}`, '_blank')}>Facture</button>
                                                        {orderView === "pending" && (
                                                            <>
                                                                {["paid", "preparing"].includes(order.order.status) && (
                                                                    <button className="cancel" onClick={() => {
                                                                        setCancelOrderId(order._id);
                                                                        setCancelReason("");
                                                                        setCancelMessage("");
                                                                        setCancelStatus("idle");
                                                                    }}>
                                                                        Demander annulation
                                                                    </button>
                                                                )}
                                                                {order.order.status === "delivered" && (
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
                                                    {order.products.map((product, index) => (
                                                        <div key={product._id || `${order._id}-product-${index}`} className="product">
                                                            {(product.image || product.images?.[0]) && (
                                                                <img src={product.image || product.images?.[0]} alt={product.name} />
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
            {cancelOrderId && (() => {
                const cancelOrder = orders.find(o => o._id === cancelOrderId);
                if (!cancelOrder) return null;
                const handleSubmit = async () => {
                    if (!cancelReason) return;
                    setCancelStatus("sending");
                    try {
                        const res = await fetch("/api/order/cancel", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                orderId: cancelOrderId,
                                reason: cancelReason,
                                message: cancelMessage,
                            }),
                        });
                        if (res.ok) {
                            setCancelStatus("sent");
                            setOrders(prev => prev.map(o =>
                                o._id === cancelOrderId
                                    ? { ...o, order: { ...o.order, status: "cancel_requested" } }
                                    : o
                            ));
                        } else {
                            setCancelStatus("error");
                        }
                    } catch {
                        setCancelStatus("error");
                    }
                };
                return (
                    <div className="cancel-modal" onClick={() => cancelStatus !== "sending" && setCancelOrderId(null)}>
                        <div className="cancel-modal-content" onClick={(e) => e.stopPropagation()}>
                            {cancelStatus === "sent" ? (
                                <>
                                    <h3>Demande envoyée</h3>
                                    <p>Votre demande d'annulation a bien été transmise. Nous reviendrons vers vous rapidement.</p>
                                    <div className="cancel-modal-actions">
                                        <button className="back" onClick={() => setCancelOrderId(null)}>Fermer</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3>Demander une annulation</h3>
                                    <div className="cancel-modal-recap">
                                        <p>Commande du {new Date(cancelOrder.order.createdAt).toLocaleDateString()}</p>
                                        <p>Montant : {cancelOrder.order.totalPrice.toFixed(2)}€</p>
                                    </div>
                                    <div className="cancel-modal-form">
                                        <label>Raison de l'annulation</label>
                                        <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                                            <option value="">-- Sélectionnez une raison --</option>
                                            <option value="Erreur de commande">Erreur de commande</option>
                                            <option value="Délai trop long">Délai trop long</option>
                                            <option value="Changement d'avis">Changement d&apos;avis</option>
                                            <option value="Autre">Autre</option>
                                        </select>
                                        <label>Message complémentaire (optionnel)</label>
                                        <textarea
                                            value={cancelMessage}
                                            onChange={(e) => setCancelMessage(e.target.value)}
                                            placeholder="Précisez votre demande..."
                                            maxLength={2000}
                                            rows={4}
                                        />
                                    </div>
                                    {cancelStatus === "error" && (
                                        <p className="cancel-modal-error">Une erreur est survenue. Veuillez réessayer.</p>
                                    )}
                                    <div className="cancel-modal-actions">
                                        <button className="back" onClick={() => setCancelOrderId(null)} disabled={cancelStatus === "sending"}>Retour</button>
                                        <button className="submit" onClick={handleSubmit} disabled={!cancelReason || cancelStatus === "sending"}>
                                            {cancelStatus === "sending" ? "Envoi en cours..." : "Envoyer la demande"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}
        </main>
    );
}