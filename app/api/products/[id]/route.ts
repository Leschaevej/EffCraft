import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Id manquant" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("effcraftdatabase");

    const result = await db
      .collection("products")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Produit non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ message: "Produit supprimé" }, { status: 200 });
  } catch (error) {
    console.error("Erreur DELETE /api/products/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
