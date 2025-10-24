import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import cloudinary from "../../../lib/cloudinary";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const { id } = params;

  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("effcraftdatabase");

    const product = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!product) {
      return NextResponse.json({ error: "Produit non trouvé" }, { status: 404 });
    }

    return NextResponse.json({
      _id: product._id.toString(),
      name: product.name,
      description: product.description,
      price: product.price,
      images: product.images,
      category: product.category,
      status: product.status || "available",
      reservedBy: product.reservedBy ? product.reservedBy.toString() : null,
    });
  } catch (error) {
    console.error("Erreur GET /api/products/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const { id } = params;

  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "Id manquant" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("effcraftdatabase");

    const product = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!product) {
      return NextResponse.json({ error: "Produit non trouvé" }, { status: 404 });
    }

    if (Array.isArray(product.images)) {
      const destroyPromises = product.images.map((url: string) => {
        const match = url.match(/\/effcraft\/products\/.*?\/([^/.]+)\.webp/);
        const publicId = match ? `effcraft/products/${id}/${match[1]}` : null;

        if (publicId) {
          return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        }
      });

      await Promise.all(destroyPromises);
    }

    const result = await db.collection("products").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ message: "Produit et images supprimés" }, { status: 200 });
  } catch (error) {
    console.error("Erreur DELETE /api/products/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}