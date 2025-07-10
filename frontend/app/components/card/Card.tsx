import React from "react";
import "./Card.scss";

type Bijou = {
  id: number;
  nom: string;
  description: string;
  image: string;
  prix: number;
};

export default function Card({ bijou }: { bijou: Bijou }) {
  return (
    <div className="card">
      <img src={bijou.image} alt={bijou.nom} />
      <h3>{bijou.nom}</h3>
      <p className="prix">{bijou.prix} €</p>
    </div>
  );
}