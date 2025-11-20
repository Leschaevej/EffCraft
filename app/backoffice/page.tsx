"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
import { FaCheck, FaBoxOpen, FaWarehouse, FaTruck, FaTruckMoving, FaHome } from "react-icons/fa";
import "./page.scss";
import AddForm from "../components/addForm/AddForm";
import DeleteForm from "../components/deleteForm/DeleteForm";

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
    billingData: any;
    shippingMethod: any;
    createdAt: string;
    userEmail: string;
    status: string;
    boxtalStatus?: string;
    boxtalShipmentId?: string;
    trackingNumber?: string;
    deliveredAt?: string;
    refundReason?: string;
    cancelledAt?: string;
    returnedAt?: string;
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
export default function Backoffice() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<"manage" | "orders">("manage");
    const [activeView, setActiveView] = useState<"add" | "delete">("add");
    const [orderView, setOrderView] = useState<"pending" | "history">("pending");
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
    useEffect(() => {
        if (status === "loading") return;
        if (!session || session.user.role !== "admin") {
        router.replace("/");
        }
    }, [session, status, router]);
    useEffect(() => {
        if (activeSection === "orders" && session?.user?.role === "admin") {
            fetchOrders();
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
                    fetchOrders();
                }
            };
            window.addEventListener("cart-update", handleOrderUpdate);
            return () => {
                window.removeEventListener("cart-update", handleOrderUpdate);
            };
        }
    }, [activeSection, orderView, session]);
    const fetchOrders = async () => {
        setLoading(true);
        try {
            const status = orderView === "pending" ? "pending" : "history";
            const response = await fetch(`/api/order?status=${status}`);
            if (response.ok) {
                const data = await response.json();
                const ordersWithStatus = await Promise.all(
                    data.orders.map(async (order: Order) => {
                        if (order.boxtalShipmentId && (order.status === "preparing" || orderView === "history")) {
                            try {
                                const syncResponse = await fetch(`/api/shipping?action=sync-status&orderId=${order._id}`);
                                if (syncResponse.ok) {
                                    const syncData = await syncResponse.json();
                                    return { ...order, status: syncData.status, boxtalStatus: syncData.boxtalStatus };
                                }
                            } catch (error) {
                                console.error("Erreur sync statut:", error);
                            }
                        }
                        return order;
                    })
                );
                setOrders(ordersWithStatus);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };
    const handlePrintLabel = async (order: Order) => {
        if (printingOrderId) {
            return;
        }
        try {
            setPrintingOrderId(order._id);
            if (!order.boxtalShipmentId) {
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
        if (!confirm(`Êtes-vous sûr de vouloir annuler la commande de ${order.userEmail} ?`)) {
            return;
        }
        try {
            const response = await fetch("/api/order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: order._id, action: "cancel" }),
            });
            if (response.ok) {
                alert("Commande annulée avec succès");
                fetchOrders();
            } else {
                const error = await response.json();
                alert("Erreur lors de l'annulation: " + (error.error || "Erreur inconnue"));
            }
        } catch (error) {
            console.error("Erreur annulation:", error);
            alert("Erreur lors de l'annulation: " + error);
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
                body: JSON.stringify({ orderId: order._id, action: "request-return" }),
            });
            if (!response.ok) {
                const error = await response.json();
                alert("Erreur lors de la demande de retour: " + (error.error || "Erreur inconnue"));
                return;
            }
            const returnData = await response.json();
            if (returnData.boxtalShipmentId || order.boxtalShipmentId) {
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
            fetchOrders();
        } catch (error) {
            console.error("Erreur génération bon de retour:", error);
            alert("Erreur: " + error);
        }
    };
    const handleRefundReturn = async (order: Order) => {
        if (!confirm(`Confirmer le remboursement pour cette commande retournée ?`)) {
            return;
        }
        try {
            const response = await fetch("/api/order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: order._id, action: "refund-return" }),
            });
            if (response.ok) {
                alert("Client remboursé avec succès");
                fetchOrders();
            } else {
                const error = await response.json();
                alert("Erreur lors du remboursement: " + (error.error || "Erreur inconnue"));
            }
        } catch (error) {
            console.error("Erreur remboursement:", error);
            alert("Erreur lors du remboursement: " + error);
        }
    };
    const getTrackingStep = (order: Order): number => STATUS_STEPS[order.status] || 1;
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
                    Gérer Produits
                </button>
                <button
                    className={activeSection === "orders" ? "active" : ""}
                    onClick={() => setActiveSection("orders")}
                    >
                    Commandes
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
                    {loading ? (
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
                                            <p>{new Date(order.createdAt).toLocaleDateString()}</p>
                                            <p className="total">{order.totalPrice.toFixed(2)}€</p>
                                            <div className="status">
                                                <div className="icon">
                                                    {getStatusIcon(order.status)}
                                                </div>
                                                <p className="label">{STATUS_LABELS[order.status] || order.status}</p>
                                            </div>
                                        </div>
                                        <div className="buttons">
                                            {orderView === "pending" ? (
                                                <button
                                                    className="print"
                                                    onClick={() => handlePrintLabel(order)}
                                                    disabled={printingOrderId === order._id}
                                                >
                                                    {printingOrderId === order._id ? "Traitement..." : "Bordereau"}
                                                </button>
                                            ) : (
                                                <button className="invoice">Facture</button>
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
                                                        <p>Date de commande : {new Date(order.createdAt).toLocaleDateString()} à {new Date(order.createdAt).toLocaleTimeString()}</p>
                                                        <p>Total : {order.totalPrice.toFixed(2)}€</p>
                                                        {order.refundReason && (
                                                            <>
                                                                <p>Motif de remboursement : {order.refundReason}</p>
                                                                <p>Date de remboursement : {new Date(order.cancelledAt || order.returnedAt || order.createdAt).toLocaleDateString()} à {new Date(order.cancelledAt || order.returnedAt || order.createdAt).toLocaleTimeString()}</p>
                                                            </>
                                                        )}
                                                        {!order.refundReason && (
                                                            <>
                                                                <p>Mode de livraison : {order.shippingMethod?.name}</p>
                                                                <p>N° de suivi : {order.trackingNumber || "En attente"}</p>
                                                            </>
                                                        )}
                                                    </div>
                                                    {order.shippingData && (
                                                        <>
                                                            <div className="info">
                                                                <h3>Livraison</h3>
                                                                <p>{order.shippingData.nom || ''} {order.shippingData.prenom || ''}</p>
                                                                <p>{order.shippingData.rue || ''}</p>
                                                                <p>{order.shippingData.codePostal || ''} {order.shippingData.ville || ''}</p>
                                                            </div>
                                                            {order.shippingData.relayPoint && (
                                                                <div className="info">
                                                                    <h3>Point relais</h3>
                                                                    <p>{order.shippingData.relayPoint.name} </p>
                                                                    <p>{order.shippingData.relayPoint.address}</p>
                                                                    <p>{order.shippingData.relayPoint.zipcode} {order.shippingData.relayPoint.city}</p>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
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
                                            <div className="actions">
                                                {["paid", "preparing"].includes(order.status) && (
                                                    <button
                                                        className="cancel"
                                                        onClick={() => handleCancelOrder(order)}
                                                    >
                                                        Annuler commande
                                                    </button>
                                                )}
                                                {["ready", "in_transit", "out_for_delivery", "delivered"].includes(order.status) && (
                                                    <button
                                                        className="return"
                                                        onClick={() => handleReturnOrder(order)}
                                                    >
                                                        Générer bon de retour
                                                    </button>
                                                )}
                                                {order.status === "return_requested" && (
                                                    <button
                                                        className="refund"
                                                        onClick={() => handleRefundReturn(order)}
                                                    >
                                                        Rembourser
                                                    </button>
                                                )}
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
        </main>
    );
}