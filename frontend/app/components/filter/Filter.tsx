"use client";

import React, { useState } from "react";
import "./Filter.scss";

type Category = "all" | "earrings" | "necklace";

type FilterButtonsProps = {
  onFilterChange: (filter: Category) => void;
};

export default function Filter({ onFilterChange }: FilterButtonsProps) {
  const [selected, setSelected] = useState<Category>("all");

  const handleClick = (filter: Category) => {
    setSelected(filter);
    onFilterChange(filter);
  };

  return (
    <div className="filter">
      <button
        className={selected === "all" ? "active" : ""}
        onClick={() => handleClick("all")}
      >
        Tout
      </button>
      <button
        className={selected === "earrings" ? "active" : ""}
        onClick={() => handleClick("earrings")}
      >
        Earrings
      </button>
      <button
        className={selected === "necklace" ? "active" : ""}
        onClick={() => handleClick("necklace")}
      >
        Necklace
      </button>
    </div>
  );
}
