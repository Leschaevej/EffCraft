"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
import { FaCheck, FaBoxOpen, FaWarehouse, FaTruck, FaTruckMoving, FaHome } from "react-icons/fa";
import "./page.scss";
import AddForm from "../components/addForm/AddForm";
import DeleteForm from "../components/deleteForm/DeleteForm";
import { useOrders } from "../hooks/useOrders";

interface Product {
    _id: string;
    name: string;
    images: string[];
    price: number;
}
interface Order {
    _id: string;
    userEmail: string;
    products: Product[];
    shippingData: {
        trackingNumber?: string;
        boxtalShipmentId?: string;
        boxtalStatus?: string;
        shippingMethod?: any;
        relayPoint?: any;
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
        returnedAt?: Date;
        preparingAt?: Date;
        readyAt?: Date;
        cancellationRequested?: boolean;
        cancellationRequestedAt?: Date;
        returnRequested?: boolean;
        returnRequestedAt?: Date;
        paymentIntentId?: string;
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
    ready: "Remis au transporteur",
    in_transit: "En transit",
    out_for_delivery: "En cours de livraison",
    delivered: "Livré",
    cancelled: "Remboursé",
    return_requested: "Retour demandé",
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
        case "MONR": // Mondial Relay
            return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${trackingNumber}`;
        case "SOGP": // Relais Colis
            return `https://www.relaiscolis.com/suivi/?code=${trackingNumber}`;
        case "POFR": // Colissimo
            return `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber}`;
        case "CHRP": // Chronopost
            return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${trackingNumber}`;
        default:
            return null;
    }
};
export default function Backoffice() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<"manage" | "orders" | "invoices" | "events">("manage");
    const [activeView, setActiveView] = useState<"add" | "delete">("add");
    const [orderView, setOrderView] = useState<"pending" | "history">("pending");
    const { orders: swrOrders, isLoading: swrLoading, mutate } = useOrders(orderView);
    const [orders, setOrders] = useState<Order[]>([]);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
    const [cancelModalMessage, setCancelModalMessage] = useState<string | null>(null);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [orderToReturn, setOrderToReturn] = useState<Order | null>(null);

    // Synchroniser les données SWR avec le state local
    useEffect(() => {
        if (JSON.stringify(swrOrders) !== JSON.stringify(orders)) {
            setOrders(swrOrders);
        }
    }, [swrOrders]);

    useEffect(() => {
        if (status === "loading") return;
        if (!session || session.user.role !== "admin") {
        router.replace("/");
        }
    }, [session, status, router]);

    useEffect(() => {
        if (activeSection === "orders" && session?.user?.role === "admin") {
            const handleOrderUpdate = (event: Event) => {
                const customEvent = event as CustomEvent;
                if (customEvent.detail?.type === "order_status_updated" && customEvent.detail?.data) {
                    const { orderId, status } = customEvent.detail.data;
                    setOrders(prev => prev.map(order =>
                        order._id === orderId ? { ...order, status } : order
                    ));
                } else if (
                    customEvent.detail?.type === "order_created" ||
                    customEvent.detail?.type === "order_deleted"
                ) {
                    mutate(); // Revalider le cache SWR
                }
            };
            window.addEventListener("cart-update", handleOrderUpdate);
            return () => {
                window.removeEventListener("cart-update", handleOrderUpdate);
            };
        }
    }, [activeSection, session, mutate]);
    const handlePrintLabel = async (order: Order) => {
        if (printingOrderId) {
            return;
        }
        try {
            setPrintingOrderId(order._id);
            if (!order.shippingData.boxtalShipmentId) {
                const createResponse = await fetch("/api/shipping", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId: order._id }),
                });
                if (!createResponse.ok) {
                    const error = await createResponse.json();
                    alert("Erreur lors de la création de l'expédition: " + (error.error || "Erreur inconnue"));
                    return;
                }
                const createResult = await createResponse.json();

                // Mettre à jour l'ordre local avec le boxtalShipmentId
                setOrders(prev => prev.map(o =>
                    o._id === order._id
                        ? {
                            ...o,
                            shippingData: {
                                ...o.shippingData,
                                boxtalShipmentId: createResult.shipmentId,
                                boxtalStatus: "PENDING"
                            }
                        }
                        : o
                ));

                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            const response = await fetch("/api/shipping?action=label", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: order._id }),
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');

                // Mettre à jour le statut localement immédiatement
                setOrders(prev => prev.map(o =>
                    o._id === order._id
                        ? { ...o, order: { ...o.order, status: "preparing" } }
                        : o
                ));
            } else {
                const contentType = response.headers.get("content-type");
                let errorMessage = "Erreur inconnue";
                if (contentType && contentType.includes("application/json")) {
                    const error = await response.json();
                    console.error("Erreur JSON:", error);
                    errorMessage = error.error || error.details || JSON.stringify(error);
                } else {
                    const errorText = await response.text();
                    console.error("Erreur texte:", errorText);
                    errorMessage = errorText;
                }
                alert("Erreur lors de la récupération du bordereau: " + errorMessage);
            }
        } catch (error) {
            console.error("Erreur impression bordereau:", error);
            alert("Erreur lors de l'impression du bordereau: " + error);
        } finally {
            setPrintingOrderId(null);
        }
    };
    const handleCancelOrder = async (order: Order) => {
        setOrderToCancel(order);
        setShowCancelModal(true);
    };
    const confirmCancelOrder = async () => {
        if (!orderToCancel) return;

        setCancelModalMessage("Remboursement en cours de traitement...");

        try {
            const response = await fetch("/api/order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: orderToCancel._id, action: "cancel" }),
            });
            if (response.ok) {
                setCancelModalMessage("La commande a bien été remboursée");
                mutate();
                setTimeout(() => {
                    setShowCancelModal(false);
                    setOrderToCancel(null);
                    setCancelModalMessage(null);
                }, 5000);
            } else {
                const error = await response.json();
                setCancelModalMessage("Problème de remboursement : " + (error.error || "Erreur inconnue"));
                setTimeout(() => {
                    setShowCancelModal(false);
                    setOrderToCancel(null);
                    setCancelModalMessage(null);
                }, 5000);
            }
        } catch (error) {
            console.error("Erreur annulation:", error);
            setCancelModalMessage("Problème de remboursement : Erreur réseau");
            setTimeout(() => {
                setShowCancelModal(false);
                setOrderToCancel(null);
                setCancelModalMessage(null);
            }, 5000);
        }
    };
    const handleReturnOrder = async (order: Order) => {
        // Générer directement le bon de retour sans confirmation (admin paye)
        if (!confirm(`Générer un bon de retour pour cette commande ?`)) {
            return;
        }

        try {
            // Mettre à jour le statut à return_requested sans remboursement
            const response = await fetch("/api/order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: order._id,
                    action: "request-return-only" // Nouveau: juste marquer le retour, pas de remboursement
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                alert("Erreur lors de la demande de retour: " + (error.error || "Erreur inconnue"));
                return;
            }

            // Générer le bon de retour Boxtal
            if (order.shippingData.boxtalShipmentId) {
                const labelResponse = await fetch("/api/shipping?action=return-label", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId: order._id }),
                });

                if (labelResponse.ok) {
                    const blob = await labelResponse.blob();
                    const url = window.URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    alert("Bon de retour généré avec succès");
                } else {
                    const contentType = labelResponse.headers.get("content-type");
                    let errorMessage = "Erreur inconnue";
                    if (contentType && contentType.includes("application/json")) {
                        const error = await labelResponse.json();
                        errorMessage = error.error || JSON.stringify(error);
                    } else {
                        errorMessage = await labelResponse.text();
                    }
                    alert("Erreur lors de la génération du bordereau: " + errorMessage);
                }
            } else {
                alert("Pas d'expédition Boxtal associée à cette commande");
            }
            mutate();
        } catch (error) {
            console.error("Erreur génération bon de retour:", error);
            alert("Erreur: " + error);
        }
    };

    const handleRefundReturn = async (order: Order) => {
        // Ouvrir la modal pour choisir le type de remboursement
        setOrderToReturn(order);
        setShowReturnModal(true);
    };

    const handleReturnChoice = async (fullRefund: boolean) => {
        if (!orderToReturn) return;
        setShowReturnModal(false);

        // Effectuer le remboursement
        try {
            const response = await fetch("/api/order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: orderToReturn._id,
                    action: "refund-return",
                    fullRefund
                }),
            });

            if (response.ok) {
                alert("Client remboursé avec succès");
                mutate();
            } else {
                const error = await response.json();
                alert("Erreur lors du remboursement: " + (error.error || "Erreur inconnue"));
            }
        } catch (error) {
            console.error("Erreur remboursement:", error);
            alert("Erreur lors du remboursement: " + error);
        }

        setOrderToReturn(null);
    };
    const handleReturnOrderWithMutate = async (order: Order) => {
        await handleReturnOrder(order);
        mutate();
    };

    const handleNextStatus = async (order: Order) => {
        // Mapping des statuts actuels vers les événements Boxtal à simuler
        const statusToEvent: { [key: string]: string } = {
            paid: "READY_TO_SHIP",
            preparing: "PICKED_UP",
            ready: "IN_TRANSIT",
            in_transit: "OUT_FOR_DELIVERY",
            out_for_delivery: "DELIVERED"
        };

        const nextEvent = statusToEvent[order.order.status];
        if (!nextEvent) {
            alert("Pas de statut suivant pour cette commande");
            return;
        }

        if (!order.shippingData.boxtalShipmentId) {
            alert("Pas de boxtalShipmentId pour cette commande");
            return;
        }

        try {
            // Simuler un webhook Boxtal
            const webhookPayload = {
                event: nextEvent,
                shipment: {
                    id: order.shippingData.boxtalShipmentId,
                    trackingNumber: order.shippingData.trackingNumber || "SIMULATED123",
                    status: nextEvent
                }
            };

            const response = await fetch("/api/webhooks/boxtal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(webhookPayload),
            });

            if (response.ok) {
                alert(`Statut simulé : ${nextEvent}`);
                mutate(); // Recharger les données
            } else {
                const error = await response.json();
                alert("Erreur lors de la simulation: " + (error.error || "Erreur inconnue"));
            }
        } catch (error) {
            console.error("Erreur simulation:", error);
            alert("Erreur lors de la simulation: " + error);
        }
    };

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
    if (status === "loading" || !session || session.user.role !== "admin") {
        return <p>Chargement...</p>;
    }
    return (
        <main className="backoffice">
            <section className="toolbar">
                <button
                    className={activeSection === "manage" ? "active" : ""}
                    onClick={() => setActiveSection("manage")}
                    >
                    Produits
                </button>
                <button
                    className={activeSection === "orders" ? "active" : ""}
                    onClick={() => setActiveSection("orders")}
                    >
                    Commandes
                </button>
                <button
                    className={activeSection === "invoices" ? "active" : ""}
                    onClick={() => setActiveSection("invoices")}
                    >
                    Factures
                </button>
                <button
                    className={activeSection === "events" ? "active" : ""}
                    onClick={() => setActiveSection("events")}
                    >
                    Événements
                </button>
            </section>
            {activeSection === "manage" && (
                <section className="manage">
                <div className="addDell">
                    <button
                        className={activeView === "add" ? "active" : ""}
                        onClick={() => setActiveView("add")}
                        >
                        Ajouter
                    </button>
                    <button
                        className={activeView === "delete" ? "active" : ""}
                        onClick={() => setActiveView("delete")}
                        >
                        Supprimer
                    </button>
                </div>
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>
                    {activeView === "add" ? "Ajouter" : "Supprimer"}
                    </h2>
                    {activeView === "add" && <AddForm />}
                    {activeView === "delete" && <DeleteForm />}
                </div>
                </section>
            )}
            {activeSection === "orders" && (
                <section className="orders">
                <div className="switch">
                    <button
                        className={orderView === "pending" ? "active" : ""}
                        onClick={() => setOrderView("pending")}
                        >
                        En cours
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
                        {orderView === "pending" ? "En cours" : "Historique"}
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
                                            {order.shippingData && (
                                                <div className="name">
                                                    <p>{order.shippingData.nom || ''}</p>
                                                    <p>{order.shippingData.prenom || ''}</p>
                                                </div>
                                            )}
                                            <p>{new Date(order.order.createdAt).toLocaleDateString()}</p>
                                            <p className="total">{order.order.totalPrice.toFixed(2)}€</p>
                                            <div className="status">
                                                <div className="icon">
                                                    {getStatusIcon(order.order.status)}
                                                </div>
                                                <p className="label">{STATUS_LABELS[order.order.status] || order.order.status}</p>
                                            </div>
                                        </div>
                                        <div className="buttons">
                                            {orderView === "pending" && ["paid", "preparing"].includes(order.order.status) && (
                                                <button
                                                    className="print"
                                                    onClick={() => handlePrintLabel(order)}
                                                    disabled={printingOrderId === order._id}
                                                >
                                                    {printingOrderId === order._id ? "Traitement..." : "Bordereau"}
                                                </button>
                                            )}
                                            <button onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}>
                                                {expandedOrderId === order._id ? "Fermer" : "Details"}
                                            </button>
                                        </div>
                                    </div>
                                    {expandedOrderId === order._id && (
                                        <div className="details">
                                            <div className="content">
                                                <div className="infos">
                                                    <div className="info">
                                                        <h3>Informations de commande</h3>
                                                        <p>Email : {order.userEmail}</p>
                                                        <p>Date de commande : {new Date(order.order.createdAt).toLocaleDateString()} à {new Date(order.order.createdAt).toLocaleTimeString()}</p>
                                                        <p>Total : {order.order.totalPrice.toFixed(2)}€</p>
                                                        {order.order.refundReason && (
                                                            <>
                                                                <p>Motif de remboursement : {order.order.refundReason}</p>
                                                                <p>Date de remboursement : {new Date(order.order.cancelledAt || order.order.returnedAt || order.order.createdAt).toLocaleDateString()} à {new Date(order.order.cancelledAt || order.order.returnedAt || order.order.createdAt).toLocaleTimeString()}</p>
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
                                                        <button className="invoice">Facture</button>
                                                        {["paid", "preparing"].includes(order.order.status) && (
                                                            <button
                                                                className="cancel"
                                                                onClick={() => handleCancelOrder(order)}
                                                            >
                                                                Annuler
                                                            </button>
                                                        )}
                                                        {order.order.status === "delivered" && (
                                                            <button
                                                                className="return"
                                                                onClick={() => handleReturnOrder(order)}
                                                            >
                                                                Retour
                                                            </button>
                                                        )}
                                                        {order.order.status === "return_requested" && (
                                                            <button
                                                                className="refund"
                                                                onClick={() => handleRefundReturn(order)}
                                                            >
                                                                Rembourser
                                                            </button>
                                                        )}
                                                        {["paid", "preparing", "ready", "in_transit", "out_for_delivery"].includes(order.order.status) && order.shippingData.boxtalShipmentId && (
                                                            <button
                                                                className="next"
                                                                onClick={() => handleNextStatus(order)}
                                                                style={{ backgroundColor: '#4CAF50', color: 'white' }}
                                                            >
                                                                Next ⏭️
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="products">
                                                    {order.products.map((product, index) => (
                                                        <div key={product._id || `${order._id}-product-${index}`} className="product">
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
            )}
            {activeSection === "invoices" && (
                <section className="invoices">
                    <div className="conteneur">
                        <h2 className={nothingYouCouldDo.className}>Factures</h2>
                        <p>Section factures en cours de développement...</p>
                    </div>
                </section>
            )}
            {activeSection === "events" && (
                <section className="events">
                    <div className="conteneur">
                        <h2 className={nothingYouCouldDo.className}>Événements</h2>
                        <p>Section événements en cours de développement...</p>
                    </div>
                </section>
            )}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => {
                    if (!cancelModalMessage) {
                        setShowCancelModal(false);
                        setOrderToCancel(null);
                        setCancelModalMessage(null);
                    }
                }}>
                    <div className="modal-content" onClick={(e) => {
                        if (!cancelModalMessage) {
                            e.stopPropagation();
                        }
                    }}>
                        {cancelModalMessage ? (
                            <>
                                <h3>
                                    {cancelModalMessage.includes("en cours")
                                        ? "Veuillez patienter"
                                        : cancelModalMessage.includes("bien été")
                                        ? "Succès"
                                        : "Erreur"}
                                </h3>
                                <p>{cancelModalMessage}</p>
                            </>
                        ) : (
                            <>
                                <h3>Annulation et remboursement</h3>
                                <p>Cette action va annuler la commande et rembourser automatiquement le client. Voulez-vous continuer ?</p>
                                <div className="modal-buttons">
                                    <button className="btn-confirm" onClick={confirmCancelOrder}>Oui</button>
                                    <button className="btn-cancel" onClick={() => {
                                        setShowCancelModal(false);
                                        setOrderToCancel(null);
                                    }}>Non</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {showReturnModal && orderToReturn && (
                <div className="modal-overlay" onClick={() => {
                    setShowReturnModal(false);
                    setOrderToReturn(null);
                }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Type de retour</h3>
                        <p>Sélectionnez le motif du retour :</p>
                        <div className="modal-buttons">
                            <button
                                className="btn-confirm"
                                onClick={() => handleReturnChoice(true)}
                            >
                                Produit défectueux<br/>
                                <small>(Remboursement complet : {orderToReturn.order.totalPrice.toFixed(2)}€)</small>
                            </button>
                            <button
                                className="btn-cancel"
                                onClick={() => handleReturnChoice(false)}
                            >
                                Changement d'avis<br/>
                                <small>(Remboursement - frais retour)</small>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}