"use client";

import React, { useEffect, useState } from "react";
import "./page.scss";
import { nothingYouCouldDo } from "./font";
import Card from "./components/card/Card";
import Filter from "./components/filter/Filter";
import Calendar from "./components/calendar/Calendar";
import Contact from "./components/contact/Contact";
import Map from "./components/map/Map";
import Carousel from "./components/carousel/Carousel";
import bijoux from "./data/bijoux.json";
import eventData from "./data/event.json";

type Category = "all" | "earrings" | "necklace";

export default function Home() {
    const { date, name, time, address, coords } = eventData.event;
    const { lat, lng } = coords;
    const [filter, setFilter] = useState<Category>("all");
    const [pageIndex, setPageIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);
    const [displayedBijoux, setDisplayedBijoux] = useState(bijoux);
    const handleFilterChange = (newFilter: Category) => {
        if (newFilter === filter) return;
        setIsFading(true);
        setTimeout(() => {
        setFilter(newFilter);
        setPageIndex(0);
        setDisplayedBijoux(
            newFilter === "all"
            ? bijoux
            : bijoux.filter((b) => b.category === newFilter)
        );
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
                    {bijoux.slice(0, 3).map((bijou) => (
                        <Card key={bijou.id} bijou={bijou} />
                    ))}
                </div>
            </div>
            </section>
            <section id="product" className="product">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Les bijoux</h2>
                    <Filter onFilterChange={handleFilterChange} selectedFilter={filter} />
                    <div className={`carouselContaineur ${isFading ? "fade" : ""}`}>
                        <Carousel
                            itemsPerPage={8}
                            pageIndex={pageIndex}
                            setPageIndex={setPageIndex}
                        >
                            {displayedBijoux.map((bijou) => (
                            <Card key={bijou.id} bijou={bijou} />
                            ))}
                        </Carousel>
                    </div>
                </div>
            </section>
            <section id="event" className="event">
                <div className="conteneur">
                    <h2 className={nothingYouCouldDo.className}>Événements</h2>
                    <div className="calendarMap">
                        <div className="calendar">
                            <Calendar date={date} time={time} />
                        </div>
                        <div className="mapContaineur">
                            <Map lat={lat} lng={lng} name={name} address={address} />
                            <div className="name">{name}</div>
                        </div>
                    </div>
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