"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
import { FaCheck, FaBoxOpen, FaTruck, FaHome, FaPencilAlt, FaTrash, FaHourglassHalf } from "react-icons/fa";
import "./page.scss";
import AddForm from "../components/addForm/AddForm";
import DeleteForm from "../components/deleteForm/DeleteForm";
import { useOrders } from "../hooks/useOrders";
import Calendar from "../components/calendar/Calendar";
interface Product {
    _id?: string;
    name: string;
    images?: string[];
    image?: string;
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
        cancelReason?: string;
        cancelMessage?: string;
        cancelRequestedAt?: Date;
        cancellationRequested?: boolean;
        cancellationRequestedAt?: Date;
        returnRequested?: boolean;
        returnRequestedAt?: Date;
        returnReason?: string;
        returnMessage?: string;
        returnPhotos?: string[];
        paymentIntentId?: string;
    };
}
const STATUS_LABELS: { [key: string]: string } = {
    paid: "Confirmé",
    preparing: "En préparation",
    in_transit: "Livraison",
    delivered: "Livré",
    cancelled: "Remboursé",
    cancel_requested: "Annulation demandée",
    return_requested: "Retour demandé",
    return_preparing: "Retour en préparation",
    return_in_transit: "En transit",
    return_delivered: "Livré",
    returned: "Remboursé"
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
    const [returnModalMessage, setReturnModalMessage] = useState<string | null>(null);
    const [showEventForm, setShowEventForm] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [eventForm, setEventForm] = useState({
        name: "",
        rue: "",
        ville: "",
        codePostal: "",
        date: "",
        heureDebut: "",
        heureFin: ""
    });
    const [events, setEvents] = useState<any[]>([]);
    useEffect(() => {
        if (JSON.stringify(swrOrders) !== JSON.stringify(orders)) {
            setOrders(swrOrders);
        }
    }, [swrOrders]);
    useEffect(() => {
        if (activeSection === "events") {
            fetchEvents();
        }
    }, [activeSection]);
    const fetchEvents = async () => {
        try {
            const response = await fetch("/api/events");
            if (response.ok) {
                const data = await response.json();
                setEvents(data);
            }
        } catch (error) {
            console.error("Erreur chargement événements:", error);
        }
    };
    const handleEditEvent = (event: any) => {
        const addressParts = event.address.split(", ");
        const rue = addressParts[0] || "";
        const villeCodePostal = addressParts[1] || "";
        const [codePostal, ...villeArray] = villeCodePostal.split(" ");
        const ville = villeArray.join(" ");
        setEventForm({
            name: event.name,
            rue: rue,
            ville: ville,
            codePostal: codePostal,
            date: event.date,
            heureDebut: event.heureDebut,
            heureFin: event.heureFin
        });
        setEditingEventId(event._id);
        setShowEventForm(true);
    };
    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) {
            return;
        }
        try {
            const response = await fetch(`/api/events?id=${eventId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                alert("Événement supprimé avec succès !");
                fetchEvents();
            } else {
                alert("Erreur lors de la suppression");
            }
        } catch (error) {
            console.error("Erreur suppression événement:", error);
            alert("Erreur lors de la suppression de l'événement");
        }
    };
    useEffect(() => {
        if (status === "loading") return;
        if (!session || session.user.role !== "admin") {
        router.replace("/");
        }
    }, [session, status, router]);
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
        setCancelModalMessage(null);
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
    const rejectCancelRequest = async () => {
        if (!orderToCancel) return;
        setCancelModalMessage("Envoi du refus en cours...");
        try {
            const response = await fetch("/api/order/cancel/reject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: orderToCancel._id }),
            });
            if (response.ok) {
                setCancelModalMessage("Demande refusée, commande passée en livraison et client notifié par mail");
                mutate();
                setTimeout(() => {
                    setShowCancelModal(false);
                    setOrderToCancel(null);
                    setCancelModalMessage(null);
                }, 5000);
            } else {
                const error = await response.json();
                setCancelModalMessage("Erreur : " + (error.error || "Erreur inconnue"));
                setTimeout(() => {
                    setShowCancelModal(false);
                    setOrderToCancel(null);
                    setCancelModalMessage(null);
                }, 5000);
            }
        } catch (error) {
            console.error("Erreur refus:", error);
            setCancelModalMessage("Erreur réseau");
            setTimeout(() => {
                setShowCancelModal(false);
                setOrderToCancel(null);
                setCancelModalMessage(null);
            }, 5000);
        }
    };
    const handleReturnOrder = async (order: Order) => {
        if (!confirm(`Générer un bon de retour pour cette commande ?`)) {
            return;
        }
        try {
            const response = await fetch("/api/order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: order._id,
                    action: "request-return-only"
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                alert("Erreur lors de la demande de retour: " + (error.error || "Erreur inconnue"));
                return;
            }
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
        setOrderToReturn(order);
        setReturnModalMessage(null);
        setShowReturnModal(true);
    };
    const rejectReturnRequest = async () => {
        if (!orderToReturn) return;
        setReturnModalMessage("Envoi du refus en cours...");
        try {
            const response = await fetch("/api/order/return/reject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: orderToReturn._id }),
            });
            if (response.ok) {
                setReturnModalMessage("Demande de retour refusée, client notifié par mail");
                mutate();
                setTimeout(() => {
                    setShowReturnModal(false);
                    setOrderToReturn(null);
                    setReturnModalMessage(null);
                }, 5000);
            } else {
                const error = await response.json();
                setReturnModalMessage("Erreur : " + (error.error || "Erreur inconnue"));
                setTimeout(() => {
                    setShowReturnModal(false);
                    setOrderToReturn(null);
                    setReturnModalMessage(null);
                }, 5000);
            }
        } catch (error) {
            console.error("Erreur refus retour:", error);
            setReturnModalMessage("Erreur réseau");
            setTimeout(() => {
                setShowReturnModal(false);
                setOrderToReturn(null);
                setReturnModalMessage(null);
            }, 5000);
        }
    };
    const acceptReturnRequest = async () => {
        if (!orderToReturn) return;
        setReturnModalMessage("Génération du bordereau de retour en cours...");
        try {
            const response = await fetch("/api/order/return/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: orderToReturn._id }),
            });
            if (response.ok) {
                setReturnModalMessage("Retour accepté, bordereau envoyé au client par mail");
                mutate();
                setTimeout(() => {
                    setShowReturnModal(false);
                    setOrderToReturn(null);
                    setReturnModalMessage(null);
                }, 5000);
            } else {
                const error = await response.json();
                setReturnModalMessage("Erreur : " + (error.error || "Erreur inconnue"));
                setTimeout(() => {
                    setShowReturnModal(false);
                    setOrderToReturn(null);
                    setReturnModalMessage(null);
                }, 5000);
            }
        } catch (error) {
            console.error("Erreur acceptation retour:", error);
            setReturnModalMessage("Erreur réseau");
            setTimeout(() => {
                setShowReturnModal(false);
                setOrderToReturn(null);
                setReturnModalMessage(null);
            }, 5000);
        }
    };
    const handleReturnOrderWithMutate = async (order: Order) => {
        await handleReturnOrder(order);
        mutate();
    };
    const getDisplayStatus = (order: Order): string => {
        return order.order.status;
    };
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
                                                {(order.products[0]?.image || order.products[0]?.images?.[0]) && (
                                                    <img src={order.products[0].image || order.products[0].images?.[0]} alt={order.products[0].name} />
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
                                                    {getStatusIcon(getDisplayStatus(order))}
                                                </div>
                                                <p className="label">{STATUS_LABELS[getDisplayStatus(order)] || getDisplayStatus(order)}</p>
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
                                                        {order.order.cancelReason && (
                                                            <>
                                                                <p>Raison d'annulation : {REFUND_REASON_LABELS[order.order.cancelReason!] || order.order.cancelReason}</p>
                                                                {order.order.cancelMessage && (
                                                                    <p>Message du client : {order.order.cancelMessage}</p>
                                                                )}
                                                            </>
                                                        )}
                                                        {order.order.refundReason && (
                                                            <>
                                                                <p>Motif de remboursement : {REFUND_REASON_LABELS[order.order.refundReason!] || order.order.refundReason}</p>
                                                                <p>Date de remboursement : {new Date(order.order.cancelledAt || order.order.returnedAt || order.order.createdAt).toLocaleDateString()} à {new Date(order.order.cancelledAt || order.order.returnedAt || order.order.createdAt).toLocaleTimeString()}</p>
                                                            </>
                                                        )}
                                                        {!order.order.refundReason && order.shippingData && (
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
                                                            {order.shippingData.shippingMethod?.relayPoint && (() => {
                                                                const tc = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                                                                return (
                                                                <div className="info">
                                                                    <h3>Point relais</h3>
                                                                    <p>{tc(order.shippingData.shippingMethod.relayPoint.name)}</p>
                                                                    <p>{tc(order.shippingData.shippingMethod.relayPoint.address)}</p>
                                                                    <p>{order.shippingData.shippingMethod.relayPoint.zipcode} {tc(order.shippingData.shippingMethod.relayPoint.city)}</p>
                                                                </div>);
                                                            })()}
                                                            {order.billingData && order.billingData !== "same" && (
                                                                <div className="info">
                                                                    <h3>Facturation</h3>
                                                                    <p>{order.billingData.prenom || ''} {order.billingData.nom || ''}</p>
                                                                    <p>{order.billingData.rue || ''}</p>
                                                                    <p>{order.billingData.codePostal || ''} {order.billingData.ville || ''}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="actions">
                                                        {order.order.status !== "cancel_requested" && (
                                                            <button className="invoice" onClick={() => window.open(`/api/invoice?orderId=${order._id}`, '_blank')}>Facture</button>
                                                        )}
                                                        {["paid", "preparing", "cancel_requested"].includes(order.order.status) && (
                                                            <button
                                                                className="cancel"
                                                                onClick={() => handleCancelOrder(order)}
                                                            >
                                                                Annuler
                                                            </button>
                                                        )}
                                                        {order.order.status === "return_requested" && (
                                                            <button
                                                                className="return"
                                                                onClick={() => handleRefundReturn(order)}
                                                            >
                                                                Retour
                                                            </button>
                                                        )}
                                                        {order.order.status === "return_delivered" && (
                                                            <button
                                                                className="refund"
                                                                onClick={() => handleRefundReturn(order)}
                                                            >
                                                                Rembourser
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
                        {!showEventForm && (
                            <button
                                className="add-event-btn"
                                onClick={() => setShowEventForm(true)}
                            >
                                Ajouter
                            </button>
                        )}
                        {showEventForm ? (
                            <div className="event-form">
                                <div className="form-group">
                                    <label>Nom de l'événement</label>
                                    <input
                                        type="text"
                                        value={eventForm.name}
                                        onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                                        placeholder="Nom de l'événement"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Rue</label>
                                    <input
                                        type="text"
                                        value={eventForm.rue}
                                        onChange={(e) => setEventForm({ ...eventForm, rue: e.target.value })}
                                        placeholder="Rue"
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Code Postal</label>
                                        <input
                                            type="text"
                                            value={eventForm.codePostal}
                                            onChange={(e) => setEventForm({ ...eventForm, codePostal: e.target.value })}
                                            placeholder="Code Postal"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Ville</label>
                                        <input
                                            type="text"
                                            value={eventForm.ville}
                                            onChange={(e) => setEventForm({ ...eventForm, ville: e.target.value })}
                                            placeholder="Ville"
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Date</label>
                                        <input
                                            type="date"
                                            value={eventForm.date}
                                            onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Heure de début</label>
                                        <input
                                            type="time"
                                            value={eventForm.heureDebut}
                                            onChange={(e) => setEventForm({ ...eventForm, heureDebut: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Heure de fin</label>
                                        <input
                                            type="time"
                                            value={eventForm.heureFin}
                                            onChange={(e) => setEventForm({ ...eventForm, heureFin: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button
                                        className="cancel-btn"
                                        onClick={() => {
                                            setShowEventForm(false);
                                            setEventForm({ name: "", rue: "", ville: "", codePostal: "", date: "", heureDebut: "", heureFin: "" });
                                            setEditingEventId(null);
                                        }}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        className="submit-btn"
                                        onClick={async () => {
                                            if (!eventForm.name || !eventForm.rue || !eventForm.ville || !eventForm.codePostal || !eventForm.date || !eventForm.heureDebut || !eventForm.heureFin) {
                                                alert("Veuillez remplir tous les champs");
                                                return;
                                            }
                                            try {
                                                if (editingEventId) {
                                                    const response = await fetch(`/api/events?id=${editingEventId}`, {
                                                        method: "PUT",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify(eventForm),
                                                    });

                                                    if (response.ok) {
                                                        alert("Événement modifié avec succès !");
                                                        setShowEventForm(false);
                                                        setEventForm({ name: "", rue: "", ville: "", codePostal: "", date: "", heureDebut: "", heureFin: "" });
                                                        setEditingEventId(null);
                                                        fetchEvents();
                                                    } else {
                                                        const error = await response.json();
                                                        alert("Erreur : " + (error.error || "Erreur inconnue"));
                                                    }
                                                } else {
                                                    const response = await fetch("/api/events", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify(eventForm),
                                                    });

                                                    if (response.ok) {
                                                        const result = await response.json();
                                                        alert("Événement ajouté avec succès !");
                                                        setShowEventForm(false);
                                                        setEventForm({ name: "", rue: "", ville: "", codePostal: "", date: "", heureDebut: "", heureFin: "" });
                                                        fetchEvents();
                                                    } else {
                                                        const error = await response.json();
                                                        alert("Erreur : " + (error.error || "Erreur inconnue"));
                                                    }
                                                }
                                            } catch (error) {
                                                console.error("Erreur événement:", error);
                                                alert("Erreur lors de l'opération");
                                            }
                                        }}
                                    >
                                        {editingEventId ? "Modifier" : "Enregistrer"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="events-list">
                                {events.length === 0 ? (
                                    <p className="empty">Aucun événement</p>
                                ) : (
                                    events.map((event) => {
                                        return (
                                            <div key={event._id} className="event-item">
                                                <Calendar date={event.date} />
                                                <div className="event-info">
                                                    <h3>{event.name}</h3>
                                                    <p className="address">{event.address}</p>
                                                    <p className="time">{event.heureDebut} - {event.heureFin}</p>
                                                </div>
                                                <div className="event-actions">
                                                    <button
                                                        className="edit-btn"
                                                        onClick={() => handleEditEvent(event)}
                                                    >
                                                        <FaPencilAlt />
                                                    </button>
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => handleDeleteEvent(event._id)}
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
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
                                        : cancelModalMessage.includes("refusée") || cancelModalMessage.includes("remboursée")
                                        ? "Succès"
                                        : "Erreur"}
                                </h3>
                                <p>{cancelModalMessage}</p>
                            </>
                        ) : (
                            <>
                                <h3>Annulation de commande</h3>
                                {orderToCancel?.order.status === "cancel_requested" ? (
                                    <>
                                        <p>Le client a demandé l'annulation de cette commande.</p>
                                        {orderToCancel.order.cancelReason && (
                                            <p><strong>Raison :</strong> {REFUND_REASON_LABELS[orderToCancel.order.cancelReason] || orderToCancel.order.cancelReason}</p>
                                        )}
                                        {orderToCancel.order.cancelMessage && (
                                            <p><strong>Message :</strong> {orderToCancel.order.cancelMessage}</p>
                                        )}
                                    </>
                                ) : (
                                    <p>Cette action va annuler la commande et rembourser automatiquement le client.</p>
                                )}
                                <div className="modal-buttons">
                                    <button className="btn-confirm" onClick={confirmCancelOrder}>Annuler et rembourser</button>
                                    {orderToCancel?.order.status === "cancel_requested" && orderToCancel?.shippingData?.boxtalShipmentId && (
                                        <button className="btn-cancel" onClick={rejectCancelRequest}>Colis déjà expédié</button>
                                    )}
                                    <button className="btn-cancel" onClick={() => {
                                        setShowCancelModal(false);
                                        setOrderToCancel(null);
                                    }}>Retour</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {showReturnModal && orderToReturn && (
                <div className="modal-overlay" onClick={() => {
                    if (!returnModalMessage) {
                        setShowReturnModal(false);
                        setOrderToReturn(null);
                    }
                }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        {returnModalMessage ? (
                            <>
                                <h3>{returnModalMessage.includes("cours") ? "Veuillez patienter" : returnModalMessage.includes("Erreur") ? "Erreur" : "Succès"}</h3>
                                <p>{returnModalMessage}</p>
                            </>
                        ) : (
                            <>
                                <h3>Demande de retour</h3>
                                <p>Le client a demandé le retour de cette commande.</p>
                                {orderToReturn.order.returnReason && (
                                    <p><strong>Raison :</strong> {orderToReturn.order.returnReason}</p>
                                )}
                                {orderToReturn.order.returnMessage && (
                                    <p><strong>Message :</strong> {orderToReturn.order.returnMessage}</p>
                                )}
                                {orderToReturn.order.returnPhotos && orderToReturn.order.returnPhotos.length > 0 && (
                                    <div className="return-photos">
                                        <p><strong>Photos :</strong></p>
                                        <div className="photos-grid">
                                            {orderToReturn.order.returnPhotos.map((url: string, i: number) => (
                                                <img key={i} src={url} alt={`Photo ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 4 }} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="modal-buttons">
                                    <button className="btn-confirm" onClick={acceptReturnRequest}>Accepter le retour</button>
                                    <button className="btn-cancel" onClick={rejectReturnRequest}>Refuser le retour</button>
                                    <button className="btn-cancel" onClick={() => { setShowReturnModal(false); setOrderToReturn(null); }}>Retour</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}