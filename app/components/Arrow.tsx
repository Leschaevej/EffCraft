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
            aria-label={isLeft ? "Image précédente" : "Image suivante"}
            className={`button ${direction}`}
            style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                alignItems: "center",
                justifyContent: "center",
            }}
            >
            {isLeft ? (
                <svg
                viewBox="0 0 20 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
                >
                <path
                    d="M0.732279 17.9828C-0.244093 19.0985 -0.244093 20.9104 0.732279 22.0261L15.7294 39.1632C16.7057 40.2789 18.2914 40.2789 19.2677 39.1632C20.2441 38.0475 20.2441 36.2356 19.2677 35.1199L6.03593 20L19.2599 4.88006C20.2363 3.76436 20.2363 1.95247 19.2599 0.836773C18.2835 -0.278924 16.6979 -0.278924 15.7215 0.836773L0.724468 17.9739L0.732279 17.9828Z"
                    fill="currentColor"
                />
                </svg>
            ) : (
                <svg
                viewBox="0 0 20 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
                >
                <path
                    d="M19.2677 17.9828C20.2441 19.0985 20.2441 20.9104 19.2677 22.0261L4.27065 39.1632C3.29428 40.2789 1.70865 40.2789 0.732279 39.1632C-0.244093 38.0475 -0.244093 36.2356 0.732279 35.1199L13.9641 20L0.74009 4.88006C-0.236282 3.76436 -0.236282 1.95247 0.74009 0.836773C1.71646 -0.278924 3.30209 -0.278924 4.27846 0.836773L19.2755 17.9739L19.2677 17.9828Z"
                    fill="currentColor"
                />
                </svg>
            )}
        </button>
    );
}