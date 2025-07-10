import React from "react";
import "./page.scss";
import Card from "../app/components/card/Card";
import bijoux from "../app/data/bijoux.json";

export default function Home() {
  return (
    <main>
        <section className="landing">
            <img src="/acceuil.webp" alt="Boucle d'oreil en bois scultpé en bois sculpté " />
            <div className="intro">
                <p className="title"> Bienvenue dans mon atelier de création artisanale ! </p>
                <p className="contenu">Ici, chaque bijou en bois est sculpté à la main avec soin et patience, transformant une matière brute en une pièce unique. Je travaille autant que possible avec des matériaux recyclés ou de récupération, pour offrir une seconde vie à ce que la nature ou le temps a laissé derrière lui. Je crois que chaque création a une histoire, et que c’est cette unicité qui la rend précieuse. Venez flâner dans mon petit jardin créatif et trouvez le bijou qui résonne avec votre personnalité, une œuvre portant l’empreinte de la main de l’artisan et l’âme du bois.</p>
                <p className="warning">Tous les bijoux que vous trouverez ici sont des pièces uniques. Si le modèle qui vous plaît n’est plus disponible, ne vous inquiétez pas : contactez-moi, je me ferai un plaisir de créer le bijou qui vous inspire.</p>
            </div>
        </section>
        <section className="new">
            <div className="conteneur">
            <h2>Nouveautés</h2>
                <div className="cards">
                    {bijoux.slice(0, 3).map((bijou) => (
                        <Card key={bijou.id} bijou={bijou} />
                    ))}
                </div>
            </div>
        </section>
        <section className="product">
            <div className="conteneur">
            <h2>Les bijoux</h2>
                <div className="cards">
                    {bijoux.slice(0, 6).map((bijou) => (
                        <Card key={bijou.id} bijou={bijou} />
                    ))}
                </div>
            </div>
        </section>
    </main>
  );
}