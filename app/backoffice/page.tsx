"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
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
    boxtalStatus?: string;
    boxtalShipmentId?: string;
}

export default function Backoffice() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<"manage" | "orders">("manage");
    const [activeView, setActiveView] = useState<"add" | "delete">("add");
    const [orderView, setOrderView] = useState<"pending" | "history">("pending");
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (status === "loading") return;
        if (!session || session.user.role !== "admin") {
        router.replace("/");
        }
    }, [session, status, router]);

    useEffect(() => {
        if (activeSection === "orders" && session?.user?.role === "admin") {
            fetchOrders();
        }
    }, [activeSection, orderView, session]);

    const fetchOrders = async (syncStatus: boolean = false) => {
        setLoading(true);
        try {
            const status = orderView === "pending" ? "paid" : "preparing";
            const response = await fetch(`/api/order?status=${status}`);
            if (response.ok) {
                const data = await response.json();
                // Synchroniser les statuts Boxtal seulement si demandé
                if (syncStatus && orderView === "history") {
                    const ordersWithStatus = await Promise.all(
                        data.orders.map(async (order: Order) => {
                            if (order.boxtalShipmentId) {
                                try {
                                    const syncResponse = await fetch(`/api/shipping?action=sync-status&orderId=${order._id}`);
                                    if (syncResponse.ok) {
                                        const syncData = await syncResponse.json();
                                        return { ...order, boxtalStatus: syncData.boxtalStatus };
                                    }
                                } catch (error) {
                                    console.error("Erreur sync statut:", error);
                                }
                            }
                            return order;
                        })
                    );
                    setOrders(ordersWithStatus);
                } else {
                    setOrders(data.orders);
                }
            }
        } catch (error) {
            console.error("Erreur chargement commandes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintLabel = async (order: Order) => {
        try {
            console.log("Traitement bordereau pour commande:", order._id);

            // Si pas encore de boxtalShipmentId, créer l'expédition d'abord
            if (!order.boxtalShipmentId) {
                console.log("Création expédition Boxtal...");
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

                console.log("Expédition Boxtal créée avec succès, attente génération bordereau...");
                // Attendre 2 secondes que Boxtal génère le bordereau
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Récupérer le PDF du bordereau depuis Boxtal
            const response = await fetch("/api/shipping?action=label", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: order._id }),
            });

            console.log("Statut de la réponse:", response.status);

            if (response.ok) {
                // Ouvrir le PDF dans un nouvel onglet
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');

                // Rafraîchir la liste des commandes
                fetchOrders();
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
        if (!confirm(`Marquer cette commande comme retournée ?`)) {
            return;
        }

        try {
            const response = await fetch("/api/order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: order._id, action: "return" }),
            });

            if (response.ok) {
                alert("Commande marquée comme retournée");
                fetchOrders();
            } else {
                const error = await response.json();
                alert("Erreur: " + (error.error || "Erreur inconnue"));
            }
        } catch (error) {
            console.error("Erreur retour:", error);
            alert("Erreur: " + error);
        }
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
                    En attente
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
                    {orderView === "pending" ? "En attente" : "Historique"}
                </h2>
                {loading ? (
                    <p className="loading">Chargement des commandes...</p>
                ) : orders.length === 0 ? (
                    <p className="empty">Aucune commande en attente</p>
                ) : (
                    <div className="list">
                        {orders.map((order) => (
                            <div key={order._id} className="order">
                                <div className="products">
                                    {order.products.map((product) => (
                                        <div key={product._id} className="item">
                                            <div className="image">
                                                {product.images && product.images.length > 0 && (
                                                    <img
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                    />
                                                )}
                                            </div>
                                            <p className="name">{product.name}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="actions">
                                    {orderView === "pending" ? (
                                        <>
                                            <button
                                                className="print"
                                                onClick={() => handlePrintLabel(order)}
                                            >
                                                Bordereau
                                            </button>
                                            <button
                                                className="cancel"
                                                onClick={() => handleCancelOrder(order)}
                                            >
                                                Annuler
                                            </button>
                                        </>
                                    ) : (
                                        order.boxtalStatus === "IN_TRANSIT" || order.boxtalStatus === "DELIVERED" ? (
                                            <button
                                                className="return"
                                                onClick={() => handleReturnOrder(order)}
                                            >
                                                Retour
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="print"
                                                    onClick={() => handlePrintLabel(order)}
                                                >
                                                    Bordereau
                                                </button>
                                                <button
                                                    className="cancel"
                                                    onClick={() => handleCancelOrder(order)}
                                                >
                                                    Annuler
                                                </button>
                                            </>
                                        )
                                    )}
                                </div>
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