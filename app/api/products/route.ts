import { NextResponse } from "next/server";
import clientPromise from "../../lib/mongodb";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import cloudinary from "../../lib/cloudinary";
import { notifyClients } from "../../lib/pusher-server";

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const products = await db.collection("products").find({}).sort({ createdAt: -1 }).toArray();
        const productsWithStringId = products.map((p) => ({
        ...p,
        _id: p._id.toString(),
        status: p.status || "available",
        reservedBy: p.reservedBy ? p.reservedBy.toString() : null,
        reservedUntil: p.reservedUntil || null,
        }));
        return NextResponse.json(productsWithStringId);
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
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
        status: "available",
        createdAt: new Date(),
        });
        const productId = insertedId.toString();
        // Créer un slug à partir du nom du produit
        const slug = data.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
            .replace(/[^a-z0-9]+/g, "-") // Remplacer les caractères spéciaux par des tirets
            .replace(/^-+|-+$/g, ""); // Enlever les tirets au début et à la fin
        const folderName = `${slug}-${productId}`;

        const savedImages: string[] = [];
        for (const base64 of data.images) {
        const matches = base64.match(/^data:image\/\w+;base64,(.+)$/);
        if (!matches) continue;
        const uploadResult = await cloudinary.uploader.upload(base64, {
            folder: `effcraft/products/${folderName}`,
            public_id: uuidv4(),
            format: "webp",
            transformation: [{ width: 600, crop: "limit" }],
        });
        savedImages.push(uploadResult.secure_url);
        }
        await db.collection("products").updateOne(
        { _id: insertedId },
        { $set: { images: savedImages, cloudinaryFolder: folderName } }
        );
        notifyClients({
        type: "product_created",
        data: { productId: productId }
        });
        return NextResponse.json({ insertedId: productId, images: savedImages });
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}