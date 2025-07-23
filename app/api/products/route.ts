import { NextResponse } from "next/server";
import clientPromise from "../../lib/mongodb";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const products = await db.collection("products").find({}).toArray();
        const productsWithStringId = products.map((p) => ({
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
        const data = await request.json();
        const { insertedId } = await db.collection("products").insertOne({
        name: data.name,
        price: parseFloat(data.price),
        description: data.description,
        category: data.category,
        images: [],
        });
        const productId = insertedId.toString();
        const productDir = path.join(process.cwd(), "public", "products", productId);
        await fs.mkdir(productDir, { recursive: true });
        const savedImages: string[] = [];
        for (const base64 of data.images) {
        const matches = base64.match(/^data:image\/\w+;base64,(.+)$/);
        if (!matches) continue;
        const buffer = Buffer.from(matches[1], "base64");
        const fileName = `${uuidv4()}.webp`;
        const filePath = path.join(productDir, fileName);
        await sharp(buffer)
            .resize(800) // largeur max 800 px (hauteur auto)
            .webp({ quality: 80 })
            .toFile(filePath);
        savedImages.push(`/products/${productId}/${fileName}`);
        }
        await db.collection("products").updateOne(
        { _id: insertedId },
        { $set: { images: savedImages } }
        );
        return NextResponse.json({ insertedId: productId, images: savedImages });
    } catch (error) {
        console.error("Erreur POST /api/products :", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}