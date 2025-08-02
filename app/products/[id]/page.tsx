import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import "./page.scss";
import Card from "../../components/card/Card";
import AddToCartButton from "../AddToCart";

type Bijou = {
    _id: string;
    name: string;
    description: string;
    price: number;
    images: string[];
    category?: string;
};
type Props = {
    params: { id: string };
};
export async function generateStaticParams() {
    const client = await clientPromise;
    const db = client.db("effcraftdatabase");
    const produits = await db
        .collection("products")
        .find({}, { projection: { _id: 1 } })
        .toArray();
    return produits.map((produit) => ({
        id: produit._id.toString(),
    }));
}
export default async function ProductPage({ params }: Props) {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return notFound();
    const client = await clientPromise;
    const db = client.db("effcraftdatabase");
    const collection = db.collection("products");
    const bijouRaw = await collection.findOne({ _id: new ObjectId(id) });
    if (!bijouRaw) return notFound();
    const bijou: Bijou = {
        _id: bijouRaw._id.toString(),
        name: bijouRaw.name,
        description: bijouRaw.description,
        price: bijouRaw.price,
        images: bijouRaw.images,
        category: bijouRaw.category,
    };
    return (
        <main className="product">
            <div className="conteneur">
                <Card
                    bijou={bijou}
                    clickable={false}
                    showPrice={false}
                    showName={false}
                />
                <div className="info">
                    <h3>{bijou.name}</h3>
                    <p className="price">{bijou.price} €</p>
                    <p className="description">{bijou.description}</p>
                    <AddToCartButton bijou={bijou} />
                </div>
            </div>
        </main>
    );
}