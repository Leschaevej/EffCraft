"use client";

import React from "react";
import "./Filter.scss";

type Category = "all" | "earrings" | "necklace";

type FilterButtonsProps = {
    onFilterChange: (filter: Category) => void;
    selectedFilter: Category;
};

export default function Filter({ onFilterChange, selectedFilter }: FilterButtonsProps) {
    const handleClick = (filter: Category) => {
        onFilterChange(filter);
    };
    return (
        <div className="filter">
            <button
                className={selectedFilter === "all" ? "active" : ""}
                onClick={() => handleClick("all")}
            >
                Tout
            </button>
            <button
                className={selectedFilter === "necklace" ? "active" : ""}
                onClick={() => handleClick("necklace")}
            >
                Collier
            </button>
            <button
                className={selectedFilter === "earrings" ? "active" : ""}
                onClick={() => handleClick("earrings")}
            >
                Boucles d'oreilles
            </button>
        </div>
    );
}