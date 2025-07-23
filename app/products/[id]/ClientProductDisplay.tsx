"use client";

import React, { useState } from "react";

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

    return (
        <main key={bijou._id.toString()}>
            <section className="product">
                <div className="conteneur">
                    <div className="image-carousel">
                        <div className="carousel-container">
                            <button onClick={prevImage} className="carousel-btn left" aria-label="Image précédente">
                                ←
                            </button>
                            <img src={bijou.images[currentIndex] ?? "/default.jpg"} alt={`${bijou.name} - image ${currentIndex + 1}`} className="main-image" />
                            <button onClick={nextImage} className="carousel-btn right" aria-label="Image suivante">
                                →
                            </button>
                        </div>
                        <div className="thumbnails">
                            {bijou.images.map((img, index) => (
                                <img
                                key={index}
                                src={img}
                                alt={`Miniature ${index + 1}`}
                                className={`thumbnail ${index === currentIndex ? "active" : ""}`}
                                onClick={() => setCurrentIndex(index)}
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