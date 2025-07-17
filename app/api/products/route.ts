import { NextResponse } from "next/server";
import clientPromise from "../../lib/mongodb";

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const products = await db.collection("products").find({}).toArray();

        const productsWithStringId = products.map(p => ({
        ...p,
        _id: p._id.toString(),
        }));

        return NextResponse.json(productsWithStringId);
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}


export async function POST(request: Request) {
    try {
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const product = await request.json();
        const result = await db.collection("products").insertOne(product);
        return NextResponse.json({ insertedId: result.insertedId.toString() });
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
