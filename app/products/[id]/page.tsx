import clientPromise from "../../lib/mongodb";
import { notFound } from "next/navigation";
import "./page.scss";

type Props = {
  params: { id: string };
};

export async function generateStaticParams() {
  const client = await clientPromise;
  const db = client.db("effcraftdatabase");

  const bijoux = await db.collection("products").find({}).toArray();

  return bijoux.map((bijou) => ({
    id: bijou.id.toString(),
  }));
}

export default async function ProductPage({ params }: Props) {
    const id = parseInt(params.id);
    const client = await clientPromise;
    const db = client.db("effcraftdatabase");
    const bijou = await db.collection("products").findOne({ id });
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