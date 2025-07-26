"use client";

import React, { useState } from "react";
import ArrowButton from "../../components/Arrow";

type Bijou = {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
};

export default function ClientProductDisplay({ bijou }: { bijou: Bijou }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % bijou.images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev === 0 ? bijou.images.length - 1 : prev - 1));
  };

  const selectImage = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <main key={bijou._id.toString()}>
      <section className="product">
        <div className="conteneur">
          <div className="productCarousel">
            <div className="container">
              <ArrowButton direction="left" onClick={prevImage} />
              <img
                src={bijou.images[currentIndex] ?? "/default.jpg"}
                alt={`${bijou.name} - image ${currentIndex + 1}`}
                className="image"
              />
              <ArrowButton direction="right" onClick={nextImage} />
            </div>
            <div className="thumbnails">
              {bijou.images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Miniature ${index + 1}`}
                  className={`miniature ${index === currentIndex ? "active" : ""}`}
                  onClick={() => selectImage(index)}
                />
              ))}
            </div>
          </div>
          <div className="details">
            <h3>{bijou.name}</h3>
            <p className="prix">{bijou.price} €</p>
            <p className="description">{bijou.description}</p>
          </div>
        </div>
      </section>
    </main>
  );
}