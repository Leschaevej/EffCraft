import React from "react";
import { notFound } from "next/navigation";
import bijoux from "../../data/bijoux.json";
import "./page.scss";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function ProductPage({ params }: Props) {
    const awaitedParams = await params;
    const id = parseInt(awaitedParams.id);
    const bijou = bijoux.find((b) => b.id === id);

    if (!bijou) return notFound();

    return (
        <main>
            <section className="product">
                <div className="conteneur">
                    <div className="image">
                        <img src={bijou.image} alt={bijou.nom} />
                    </div>
                    <div className="details">
                        <h3>{bijou.nom}</h3>
                        <p className="prix">{bijou.prix} €</p>
                        <p className="description">{bijou.description}</p>
                    </div>
                </div>
                
            </section>
        </main>
    );
}