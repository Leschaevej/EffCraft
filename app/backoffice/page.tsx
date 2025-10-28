"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { nothingYouCouldDo } from "../font";
import "./page.scss";
import AddForm from "../components/addForm/AddForm";
import DeleteForm from "../components/deleteForm/DeleteForm";

export default function Backoffice() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<"manage" | "orders">("manage");
    const [activeView, setActiveView] = useState<"add" | "delete">("add");
    useEffect(() => {
        if (status === "loading") return;
        if (!session || session.user.role !== "admin") {
        router.replace("/");
        }
    }, [session, status, router]);
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
            <div className="conteneur">
                <h2 className={nothingYouCouldDo.className}>Commandes</h2>
                <p>Liste des commandes à afficher ici.</p>
            </div>
            </section>
        )}
        </main>
    );
}