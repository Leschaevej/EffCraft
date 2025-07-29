"use client";

import React from "react";

type ArrowButtonProps = {
  direction: "left" | "right";
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export default function ArrowButton({ direction, onClick }: ArrowButtonProps) {
  const isLeft = direction === "left";
  return (
    <button
      onClick={onClick}
      className={`button ${direction}`}
      aria-label={isLeft ? "Image précédente" : "Image suivante"}
      onPointerDown={(e) => {
        if (!(e.target instanceof SVGPathElement)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ pointerEvents: "none" }}
      >
        <path
          d={isLeft ? "M15 18L9 12L15 6" : "M9 6L15 12L9 18"}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "auto", cursor: "pointer" }}
        />
      </svg>
    </button>
  );
}