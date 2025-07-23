import React from "react";
import "../components/card/Card.scss";

export default function CardSkeleton() {
    return (
        <div className="card skeleton">
            <div className="image-placeholder" />
                <h3 className="text-placeholder short" />
                <p className="text-placeholder long" />
        </div>
    );
}
