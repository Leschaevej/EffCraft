"use client";

import React, { useState } from "react";
import { nothingYouCouldDo } from "../font";
import "./page.scss";
import AddForm from "../components/addForm/AddForm";
import DeleteForm from "../components/deleteForm/DeleteForm";

export default function Backoffice() {
  
  const [activeView, setActiveView] = useState<"add" | "delete">("add");

  return (
    <main className="backoffice">
      <section className="manage">
        <div className="toolbar">
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
    </main>
  );
}
