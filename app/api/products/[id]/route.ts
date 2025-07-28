import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

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