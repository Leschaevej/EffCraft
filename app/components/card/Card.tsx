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

export default function Card({ bijou }: { bijou: Bijou }) {
    return (
        <Link href={`/products/${bijou._id}`}>
            <div className="card">
                <img
                src={bijou.images?.[0] ?? "/default.jpg"}
                alt={bijou.name}
                />
                <h3>{bijou.name}</h3>
                <p className="prix">{bijou.price} €</p>
            </div>
        </Link>
    );
}