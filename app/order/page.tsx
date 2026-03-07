"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
import { FaCheck, FaBoxOpen, FaTruck, FaHome, FaHourglassHalf } from "react-icons/fa";
import "./page.scss";
import { useUserOrders } from "../hooks/useOrders";

const DOT_SIZE = 8;
const DOT_GAP = 8;

function Connector({ active, next }: { active: boolean; next: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const [count, setCount] = useState(0);
    useEffect(() => {
        const update = () => {
            if (ref.current) {
                const w = ref.current.offsetWidth;
                setCount(Math.floor(w / (DOT_SIZE + DOT_GAP)));
            }
        };
        update();
        const obs = new ResizeObserver(update);
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className="connector">
            {Array.from({ length: count }).map((_, i) => (
                <span
                    key={i}
                    className={`dot ${active ? "active" : ""} ${next ? "next" : ""}`}
                    style={next ? { animationDelay: `${(i / count) * 2}s` } : undefined}
                />
            ))}
        </div>
    );
}
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
    billingData: any;
    order: {
        totalPrice: number;
        status: string;
        createdAt: Date;
        deliveredAt?: Date;
        refundReason?: string;
        cancelledAt?: Date;
        refundedAt?: Date;
        readyAt?: Date;
        cancelReason?: string;
        cancelMessage?: string;
        returnTrackingNumber?: string;
        returnReason?: string;
        returnRequestedAt?: Date;
        returnItems?: { name: string; price: number }[];
        refundAmount?: number;
    };
    _returnId?: string;
}
const TRACKING_STEPS = [
    { label: "Confirmé", icon: <FaCheck /> },
    { label: "En préparation", icon: <FaBoxOpen /> },
    { label: "Livraison", icon: <FaTruck /> },
    { label: "Livré", icon: <FaHome /> }
];
const RETURN_TRACKING_STEPS = [
    { label: "Traitement", icon: <FaHourglassHalf /> },
    { label: "Préparation", icon: <FaBoxOpen /> },
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
    return_preparing: 2,
    return_in_transit: 3,
    return_delivered: 4,
    return_refunded: 4,
    return_rejected: 1
};
const STATUS_LABELS: { [key: string]: string } = {
    paid: "Confirmé",
    preparing: "En préparation",
    in_transit: "Livraison",
    delivered: "Livré",
    cancelled: "Remboursé",
    cancel_requested: "Demande en cours",
    return_requested: "Traitement",
    return_preparing: "Préparation",
    return_in_transit: "Livraison",
    return_delivered: "Livré",
    return_refunded: "Remboursé",
    return_rejected: "Retour refusé"
};
const REFUND_REASON_LABELS: { [key: string]: string } = {
    error: "Erreur de commande",
    delay: "Délai trop long",
    regret: "Changement d'avis",
    other: "Autre",
    cancelled: "Annulation"
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
    const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
    const [returnOrderSnapshot, setReturnOrderSnapshot] = useState<Order | null>(null);
    const [returnReason, setReturnReason] = useState("");
    const [returnMessage, setReturnMessage] = useState("");
    const [returnPhotos, setReturnPhotos] = useState<File[]>([]);
    const [returnStatus, setReturnStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [returnSelectedItems, setReturnSelectedItems] = useState<string[]>([]);
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

                    const pendingStatuses = ["paid", "preparing", "in_transit", "cancel_requested", "return_requested", "return_preparing", "return_in_transit"];
                    const finalStatuses = ["delivered", "cancelled", "return_delivered", "return_refunded", "return_rejected"];
                    // Statuts finaux : rechargement complet (données retour enrichies depuis l'API)
                    if (finalStatuses.includes(status)) {
                        mutate();
                        return;
                    }
                    const shouldBeInCurrentView = orderView === "pending"
                        ? pendingStatuses.includes(status)
                        : false;
                    if (shouldBeInCurrentView) {
                        setOrders(prev => prev.map(order =>
                            order._id === orderId
                                ? { ...order, order: { ...order.order, status } }
                                : order
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
            return_refunded: <FaCheck />,
            return_rejected: <FaCheck />,
            return_requested: <FaHourglassHalf />,
            return_preparing: <FaBoxOpen />,
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
                                            <div className="content">
                                                <div className="infos">
                                                    {orderView === "pending" && order.order.status !== "cancel_requested" && (
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
                                                                                <Connector active={isConnectorActive} next={index + 1 === currentStep} />
                                                                            )}
                                                                        </React.Fragment>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    )}
                                                    <div className="info-row">
                                                        <div className="info">
                                                            <h3>Informations de commande</h3>
                                                            <p>Date de commande : {new Date(order.order.createdAt).toLocaleDateString()}</p>
                                                            {(order.order.cancelledAt || order.order.refundedAt) && (
                                                                <p>Date de remboursement : {new Date(order.order.cancelledAt || order.order.refundedAt!).toLocaleDateString()}</p>
                                                            )}
                                                            {order.order.returnReason && order.order.status.startsWith("return_") && (
                                                                <p>Motif de retour : {order.order.returnReason}</p>
                                                            )}
                                                            {order.order.refundReason && !order.order.status.startsWith("return_") && (
                                                                <p>Motif de remboursement : {REFUND_REASON_LABELS[order.order.refundReason] || order.order.refundReason}</p>
                                                            )}
                                                            {!order.order.refundReason && order.shippingData && (
                                                                <>
                                                                    <p>Mode de livraison : {getShippingMethodName(order.shippingData.shippingMethod?.operator, order.shippingData.shippingMethod?.serviceCode)}</p>
                                                                    {order.order.returnTrackingNumber && order.order.status.startsWith("return_") && order.order.status !== "return_rejected" ? (
                                                                        <p>
                                                                            N° de suivi : {order.order.returnTrackingNumber ? (
                                                                                (() => {
                                                                                    const trackingUrl = getTrackingUrl(order.order.returnTrackingNumber, order.shippingData.shippingMethod?.operator);
                                                                                    return trackingUrl ? (
                                                                                        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mainColor)', textDecoration: 'underline' }}>
                                                                                            {order.order.returnTrackingNumber}
                                                                                        </a>
                                                                                    ) : order.order.returnTrackingNumber;
                                                                                })()
                                                                            ) : "En attente"}
                                                                        </p>
                                                                    ) : order.shippingData.trackingNumber && order.order.status !== "delivered" && order.order.status !== "cancel_requested" && (
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
                                                                    )}
                                                                </>
                                                            )}
                                                            <p>Total : {order.order.totalPrice.toFixed(2)}€</p>
                                                        </div>
                                                        {order.order.status.startsWith("return_") && order.order.status !== "return_rejected" ? (
                                                            <div className="info">
                                                                <h3>Livraison</h3>
                                                                <p>Atelier EffCraft</p>
                                                            </div>
                                                        ) : order.order.status !== "return_rejected" && order.shippingData && (
                                                            <>
                                                                {order.shippingData.shippingMethod?.relayPoint ? (() => {
                                                                    const tc = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                                                                    return (
                                                                        <div className="info">
                                                                            <h3>Point relais</h3>
                                                                            <p>{tc(order.shippingData.shippingMethod.relayPoint.name)}</p>
                                                                            <p>{tc(order.shippingData.shippingMethod.relayPoint.address)}</p>
                                                                            <p>{order.shippingData.shippingMethod.relayPoint.zipcode} {tc(order.shippingData.shippingMethod.relayPoint.city)}</p>
                                                                        </div>
                                                                    );
                                                                })() : (
                                                                    <div className="info">
                                                                        <h3>Livraison</h3>
                                                                        <p>{order.shippingData.prenom || ''} {order.shippingData.nom || ''}</p>
                                                                        <p>{order.shippingData.rue || ''}</p>
                                                                        <p>{order.shippingData.codePostal || ''} {order.shippingData.ville || ''}</p>
                                                                    </div>
                                                                )}
                                                                <div className="info">
                                                                    {order.billingData && order.billingData !== "same" && (
                                                                        <>
                                                                            <h3>Facturation</h3>
                                                                            <p>{order.billingData.prenom || ''} {order.billingData.nom || ''}</p>
                                                                            <p>{order.billingData.rue || ''}</p>
                                                                            <p>{order.billingData.codePostal || ''} {order.billingData.ville || ''}</p>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="actions">
                                                        {order.order.status !== "cancel_requested" && (
                                                            <button className="invoice" onClick={() => {
                                                                const url = order._returnId
                                                                    ? `/api/invoice?orderId=${order._id}&returnId=${order._returnId}`
                                                                    : `/api/invoice?orderId=${order._id}`;
                                                                window.open(url, '_blank');
                                                            }}>
                                                                {order._returnId ? "Avoir" : "Facture"}
                                                            </button>
                                                        )}
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
                                                            </>
                                                        )}
                                                        {orderView === "history" && order.order.status === "delivered" && (
                                                            <button className="return" onClick={() => {
                                                                setReturnOrderId(order._id);
                                                                setReturnOrderSnapshot(order);
                                                                setReturnReason("");
                                                                setReturnMessage("");
                                                                setReturnPhotos([]);
                                                                setReturnStatus("idle");
                                                                setReturnSelectedItems([]);
                                                            }}>
                                                                Demander un retour
                                                            </button>
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
                    if (!cancelReason || cancelMessage.length < 20) return;
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
                                    <div className="cancel-modal-form">
                                        <label>Raison de l'annulation</label>
                                        <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                                            <option value="">-- Sélectionnez une raison --</option>
                                            <option value="Erreur de commande">Erreur de commande</option>
                                            <option value="Délai trop long">Délai trop long</option>
                                            <option value="Changement d'avis">Changement d&apos;avis</option>
                                            <option value="Autre">Autre</option>
                                        </select>
                                        <label>Message</label>
                                        <textarea
                                            value={cancelMessage}
                                            onChange={(e) => setCancelMessage(e.target.value)}
                                            placeholder="Précisez votre demande..."
                                            maxLength={300}
                                            rows={4}
                                        />
                                        <p className="return-char-count" style={{ color: cancelMessage.length >= 300 ? "var(--errorColor)" : "var(--thirdColor)" }}>
                                            {cancelMessage.length}/300
                                        </p>
                                    </div>
                                    {cancelStatus === "error" && (
                                        <p className="cancel-modal-error">Une erreur est survenue. Veuillez réessayer.</p>
                                    )}
                                    <div className="cancel-modal-actions">
                                        <button className="back" onClick={() => setCancelOrderId(null)} disabled={cancelStatus === "sending"}>Retour</button>
                                        <button className="submit" onClick={handleSubmit} disabled={!cancelReason || cancelMessage.length < 20 || cancelStatus === "sending"}>
                                            {cancelStatus === "sending" ? "Envoi en cours..." : "Envoyer la demande"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}
            {returnOrderId && (() => {
                const returnOrder = returnOrderSnapshot;
                if (!returnOrder) return null;
                const handleReturnSubmit = async () => {
                    if (!returnReason || returnSelectedItems.length === 0 || returnMessage.length < 20 || returnPhotos.length === 0) return;
                    setReturnStatus("sending");
                    try {
                        const formData = new FormData();
                        formData.append("orderId", returnOrderId);
                        formData.append("reason", returnReason);
                        formData.append("message", returnMessage);
                        formData.append("returnItems", JSON.stringify(returnSelectedItems));
                        returnPhotos.forEach(photo => formData.append("photos", photo));
                        const res = await fetch("/api/order/return/request", {
                            method: "POST",
                            body: formData,
                        });
                        if (res.ok) {
                            setReturnStatus("sent");
                            setTimeout(() => {
                                setReturnOrderId(null);
                                setReturnOrderSnapshot(null);
                                setReturnStatus("idle");
                            }, 2000);
                        } else {
                            setReturnStatus("error");
                        }
                    } catch {
                        setReturnStatus("error");
                    }
                };
                return (
                    <div className="cancel-modal" onClick={() => { if (returnStatus !== "sending") { setReturnOrderId(null); setReturnOrderSnapshot(null); setReturnStatus("idle"); } }}>
                        <div className="cancel-modal-content" onClick={(e) => e.stopPropagation()}>
                            {returnStatus === "sent" ? (
                                <>
                                    <h3>Demande envoyée</h3>
                                    <p>Votre demande de retour a bien été transmise. Nous reviendrons vers vous rapidement.</p>
                                </>
                            ) : (
                                <>
                                    <h3>Demander un retour</h3>
                                    <div className="cancel-modal-form">
                                        <label>Articles à retourner</label>
                                        <div className="return-items-grid">
                                            {returnOrder.products.map((product, index) => {
                                                const itemKey = product._id || `${returnOrderId}-${index}`;
                                                const selected = returnSelectedItems.includes(itemKey);
                                                const img = product.image || product.images?.[0];
                                                return (
                                                    <div
                                                        key={itemKey}
                                                        className={`return-item-card ${selected ? "selected" : ""}`}
                                                        onClick={() => {
                                                            if (selected) {
                                                                setReturnSelectedItems(prev => prev.filter(k => k !== itemKey));
                                                            } else {
                                                                setReturnSelectedItems(prev => [...prev, itemKey]);
                                                            }
                                                        }}
                                                    >
                                                        {img && <img src={img} alt={product.name} />}
                                                        <p>{product.name}</p>
                                                        <p className="price">{product.price.toFixed(2)}€</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <label>Raison du retour</label>
                                        <select value={returnReason} onChange={(e) => setReturnReason(e.target.value)}>
                                            <option value="">-- Sélectionnez une raison --</option>
                                            <option value="Produit défectueux">Produit défectueux</option>
                                            <option value="Produit non conforme">Produit non conforme à la description</option>
                                            <option value="Changement d'avis">Changement d&apos;avis</option>
                                            <option value="Erreur de commande">Erreur de commande</option>
                                            <option value="Autre">Autre</option>
                                        </select>
                                        <label>Message</label>
                                        <textarea
                                            value={returnMessage}
                                            onChange={(e) => setReturnMessage(e.target.value)}
                                            placeholder="Décrivez votre problème..."
                                            maxLength={300}
                                            rows={4}
                                        />
                                        <p className="return-char-count" style={{ color: returnMessage.length >= 300 ? "var(--errorColor)" : "var(--thirdColor)" }}>
                                            {returnMessage.length}/300
                                        </p>
                                        <label>Photo</label>
                                        <div className="return-photo-wrapper">
                                            <div
                                                className="return-photo-upload"
                                                onClick={() => document.getElementById("return-photo-input")?.click()}
                                            >
                                                {returnPhotos.length > 0
                                                    ? <img src={URL.createObjectURL(returnPhotos[0])} alt="preview" />
                                                    : <span>+</span>
                                                }
                                            </div>
                                            {returnPhotos.length > 0 && (
                                                <button
                                                    className="return-photo-delete"
                                                    onClick={(e) => { e.stopPropagation(); setReturnPhotos([]); }}
                                                    type="button"
                                                >×</button>
                                            )}
                                        </div>
                                        <input
                                            id="return-photo-input"
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                setReturnPhotos(file ? [file] : []);
                                            }}
                                        />
                                    </div>
                                    {returnStatus === "error" && (
                                        <p className="cancel-modal-error">Une erreur est survenue. Veuillez réessayer.</p>
                                    )}
                                    <div className="cancel-modal-actions">
                                        <button className="back" onClick={() => { setReturnOrderId(null); setReturnOrderSnapshot(null); setReturnStatus("idle"); }} disabled={returnStatus === "sending"}>Retour</button>
                                        <button className="submit" onClick={handleReturnSubmit} disabled={!returnReason || returnSelectedItems.length === 0 || returnMessage.length < 20 || returnPhotos.length === 0 || returnStatus === "sending"}>
                                            {returnStatus === "sending" ? "Envoi en cours..." : "Envoyer la demande"}
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