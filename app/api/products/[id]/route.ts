import { NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import cloudinary from "../../../lib/cloudinary";
import { notifyClients } from "../../../lib/pusher-server";

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
        // Supprimer les images et le dossier Cloudinary
        if (product.cloudinaryFolder) {
            // Si le dossier est sauvegardé, supprimer tout le dossier
            try {
                await cloudinary.api.delete_resources_by_prefix(`effcraft/products/${product.cloudinaryFolder}`);
                await cloudinary.api.delete_folder(`effcraft/products/${product.cloudinaryFolder}`);
            } catch (error) {
                console.error("Erreur lors de la suppression du dossier Cloudinary:", error);
            }
        } else if (Array.isArray(product.images)) {
            // Fallback pour les anciens produits sans cloudinaryFolder
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
        const usersCollection = db.collection("users");
        const productObjectId = new ObjectId(id);
        await usersCollection.updateMany(
        { favorites: productObjectId },
        { $pull: { favorites: productObjectId } } as any
        );
        await usersCollection.updateMany(
        { "cart.productId": productObjectId },
        { $pull: { cart: { productId: productObjectId } } } as any
        );
        await notifyClients({
        type: "product_deleted",
        data: { productId: id }
        });
        return NextResponse.json({ message: "Produit et images supprimés" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}