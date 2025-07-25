import React from "react";
import "./Card.scss";
import Link from "next/link";

type Bijou = {
    _id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    images: string[];
};

type CardProps = {
    bijou: Bijou;
    clickable?: boolean;
};

export default function Card({ bijou, clickable = true }: CardProps) {
    const content = (
        <div className="card">
            <img src={bijou.images?.[0] ?? "/default.jpg"} alt={bijou.name} />
            <h3>{bijou.name}</h3>
            <p className="prix">{bijou.price} €</p>
        </div>
    );

    if (clickable) {
        return <Link href={`/products/${bijou._id}`}>{content}</Link>;
    } else {
        return content;
    }
}