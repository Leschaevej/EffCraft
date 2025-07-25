import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import "./page.scss";
import ClientProductDisplay from "../[id]/ClientProductDisplay";

type Params = {
    id: string;
};
type Bijou = {
    _id: string;
    name: string;
    description: string;
    price: number;
    images: string[];
};
export async function generateStaticParams() {
    const client = await clientPromise;
    const db = client.db("effcraftdatabase");
    const produits = await db.collection("products").find({}, { projection: { _id: 1 } }).toArray();
    return produits.map((produit) => ({
        id: produit._id.toString(),
    }));
}
export default async function ProductPage({ params }: { params: Promise<Params> }) {
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
    };
    return <ClientProductDisplay bijou={bijou} />;
}