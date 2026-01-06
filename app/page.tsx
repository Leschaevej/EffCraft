"use client";

import React, { useEffect, useState } from "react";
import "./page.scss";
import { nothingYouCouldDo } from "./font";
import Card from "./components/card/Card";
import CardSkeleton from "./components/card/CardSkeleton";
import Filter from "./components/filter/Filter";
import Calendar from "./components/calendar/Calendar";
import Contact from "./components/contact/Contact";
import Map from "./components/map/Map";
import Carousel from "./components/carousel/Carousel";
import { useSession } from "next-auth/react";
import { useProducts } from "./hooks/useProducts";

type Category = "all" | "earrings" | "necklace";

interface EventData {
    _id: string;
    name: string;
    address: string;
    date: string;
    heureDebut: string;
    heureFin: string;
    lat?: number;
    lng?: number;
}

export default function Home() {
    const [nextEvent, setNextEvent] = useState<EventData | null>(null);
    const { data: session, status } = useSession();
    const { products: swrProducts, isLoading: swrLoading, mutate } = useProducts();
    const [filter, setFilter] = useState<Category>("all");
    const [pageIndex, setPageIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);
    const [bijoux, setBijoux] = useState<any[]>([]);
    const [displayedBijoux, setDisplayedBijoux] = useState<any[]>([]);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [showDeletedMessage, setShowDeletedMessage] = useState(false);

    // Charger le prochain événement depuis l'API
    useEffect(() => {
        async function fetchNextEvent() {
            try {
                const response = await fetch("/api/events");
                if (response.ok) {
                    const events: EventData[] = await response.json();
                    if (events.length > 0) {
                        // Trier les événements par date et prendre le plus proche
                        const sortedEvents = events.sort((a, b) =>
                            new Date(a.date).getTime() - new Date(b.date).getTime()
                        );
                        const upcomingEvent = sortedEvents.find(e =>
                            new Date(e.date) >= new Date()
                        ) || sortedEvents[0];
                        setNextEvent(upcomingEvent);
                    }
                }
            } catch (error) {
                console.error("Erreur chargement événement:", error);
            }
        }
        fetchNextEvent();
    }, []);

    // Synchroniser les produits SWR avec le state local
    useEffect(() => {
        if (!swrLoading && swrProducts && swrProducts.length > 0) {
            setBijoux(swrProducts);
        }
    }, [swrProducts, swrLoading]);

    // Mettre à jour displayedBijoux quand bijoux ou filter change
    useEffect(() => {
        if (bijoux.length > 0) {
            const productsForCarousel = filter === "all"
                ? bijoux.slice(3)
                : bijoux.filter((b: any) => b.category === filter).slice(3);
            setDisplayedBijoux(productsForCarousel);
        }
    }, [bijoux, filter]);

    useEffect(() => {
        const handleRealtimeUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { type, productId } = customEvent.detail;
            // Optimisation : mise à jour locale immédiate pour la suppression
            if (type === "product_deleted") {
                setBijoux(prev => {
                    const updated = prev.filter(b => b._id !== productId);
                    const productsForCarousel = filter === "all"
                        ? updated.slice(3)
                        : updated.filter((b: any) => b.category === filter).slice(3);
                    setDisplayedBijoux(productsForCarousel);
                    return updated;
                });
            }
            // product_created est géré automatiquement par useProducts()
        };
        window.addEventListener("cart-update", handleRealtimeUpdate);
        return () => window.removeEventListener("cart-update", handleRealtimeUpdate);
    }, [filter]);
    useEffect(() => {
    async function fetchFavorites() {
        if (status === "authenticated") {
        const pendingId = sessionStorage.getItem("pendingFavori");
        if (pendingId) {
            await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "add_favorite",
                productId: pendingId
            }),
            });
            sessionStorage.removeItem("pendingFavori");
        }
        const res = await fetch("/api/user?type=favorites");
        if (!res.ok) throw new Error("Erreur lors du chargement des favoris");
        const data = await res.json();
        const favIds = data.favorites.map((f: any) => (typeof f === "string" ? f : f._id));
        setFavorites(favIds);
        }
    }
    fetchFavorites();
    }, [status]);
    const handleFilterChange = (newFilter: Category) => {
        if (newFilter === filter) return;
        setIsFading(true);
        setTimeout(() => {
        setFilter(newFilter);
        setPageIndex(0);
        const productsForCarousel = newFilter === "all"
            ? bijoux.slice(3)
            : bijoux.filter((b) => b.category === newFilter).slice(3);
        setDisplayedBijoux(productsForCarousel);
        setIsFading(false);
        }, 500);
    };
    useEffect(() => {
        const handleFooterEvent = (e: Event) => {
        const customEvent = e as CustomEvent<Category>;
        handleFilterChange(customEvent.detail);
        };
        window.addEventListener("filter-from-footer", handleFooterEvent);
        return () => window.removeEventListener("filter-from-footer", handleFooterEvent);
    }, [filter]);
    useEffect(() => {
        const id = sessionStorage.getItem("scrollToId");
        const filterFromFooter = sessionStorage.getItem("filterFromFooter") as Category | null;
        const deletedMessage = sessionStorage.getItem("productDeletedMessage");
        if (deletedMessage) {
            setShowDeletedMessage(true);
            sessionStorage.removeItem("productDeletedMessage");
            setTimeout(() => setShowDeletedMessage(false), 5000);
        }
        if (filterFromFooter) {
        handleFilterChange(filterFromFooter);
        sessionStorage.removeItem("filterFromFooter");
        }
        if (id) {
        const section = document.getElementById(id);
        if (section) {
            setTimeout(() => {
            section.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
        sessionStorage.removeItem("scrollToId");
        }
    }, []);
    return (
        <>
        {showDeletedMessage && (
            <div className="deleted" onClick={() => setShowDeletedMessage(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Désolé !</h3>
                    <p>Ce produit vient d'être vendu.</p>
                    <div className="buttons">
                        <button onClick={() => setShowDeletedMessage(false)}>J'ai compris</button>
                    </div>
                </div>
            </div>
        )}
        <main>
            <section className="landing">
                <img src="/acceuil.webp" alt="Boucle d'oreille en bois sculpté" />
                <div className="intro">
                    <p className="title">Bienvenue dans mon atelier de création artisanale !</p>
                    <p className="contenu">
                    Ici, chaque bijou en bois est sculpté à la main avec soin et patience, transformant
                    une matière brute en une pièce unique. Je travaille autant que possible avec des
                    matériaux recyclés ou de récupération, pour offrir une seconde vie à ce que la
                    nature ou le temps a laissé derrière lui. Je crois que chaque création a une
                    histoire, et que c’est cette unicité qui la rend précieuse. Venez flâner dans mon
                    petit jardin créatif et trouvez le bijou qui résonne avec votre personnalité, une
                    œuvre portant l’empreinte de la main de l’artisan et l’âme du bois.
                    </p>
                    <p className="warning">
                    Tous les bijoux que vous trouverez ici sont des pièces uniques. Si le modèle qui vous
                    plaît n’est plus disponible, ne vous inquiétez pas : contactez-moi, je me ferai un
                    plaisir de créer le bijou qui vous inspire.
                    </p>
                </div>
            </section>
            <section id="new" className="new">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Nouveautés</h2>
                    <div className="cards">
                    {swrLoading && bijoux.length === 0
                        ? Array.from({ length: 3 }, (_, i) => <CardSkeleton key={`skeleton-${i}`} />)
                        : bijoux.slice(0, 3).map((bijou) => (
                            <Card
                            key={bijou._id || bijou.id}
                            bijou={bijou}
                            initialIsFavori={favorites.includes(bijou._id)}
                            />
                        ))}
                    </div>
                </div>
            </section>
            <section id="product" className="products">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Les bijoux</h2>
                    <Filter onFilterChange={handleFilterChange} selectedFilter={filter} />
                    <div className={`carouselContaineur ${isFading ? "fade" : ""}`}>
                        <Carousel itemsPerPage={8} pageIndex={pageIndex} setPageIndex={setPageIndex}>
                            {swrLoading && displayedBijoux.length === 0
                            ? Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)
                            : displayedBijoux.map((bijou) => (
                                <Card
                                    key={bijou._id || bijou.id}
                                    bijou={bijou}
                                    initialIsFavori={favorites.includes(bijou._id)}
                                />
                                ))}
                        </Carousel>
                    </div>
                </div>
            </section>
            <section id="event" className="event">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Événements</h2>
                    {nextEvent ? (
                        <div className="calendarMap">
                            <div className="calendar">
                                <Calendar
                                    date={nextEvent.date}
                                    time={`${nextEvent.heureDebut.substring(0, 2)}H-${nextEvent.heureFin.substring(0, 2)}H`}
                                />
                            </div>
                            <div className="mapContaineur">
                                <Map
                                    lat={nextEvent.lat || 0}
                                    lng={nextEvent.lng || 0}
                                    name={nextEvent.name}
                                    address={nextEvent.address}
                                />
                                <div className="name">{nextEvent.name}</div>
                            </div>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', padding: '30px', fontSize: '20px' }}>
                            Aucun événement à venir pour le moment
                        </p>
                    )}
                </div>
            </section>
            <section id="contact" className="contact">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Contact</h2>
                    <p className="intro">
                    Une question, une envie, ou le bijou de vos rêves en tête ?<br />
                    Parlez-m’en ici, je serai ravie de vous répondre ou de créer avec vous une pièce
                    unique.
                    </p>
                    <Contact />
                </div>
            </section>
        </main>
        </>
    );
}