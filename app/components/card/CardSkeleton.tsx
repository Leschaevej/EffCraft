import React from "react";
import "../card/Card.scss";

export default function CardSkeleton() {
    return (
        <div className="card skeleton">
            <div className="placeholder" />
                <h3 className="text short" />
                <p className="text long" />
        </div>
    );
}