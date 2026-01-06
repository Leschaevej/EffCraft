import { NextResponse } from "next/server";
import clientPromise from "../../lib/mongodb";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

// Fonction pour obtenir les coordonnées GPS depuis une adresse
async function getCoordinatesFromAddress(address: string) {
    try {
        // Utiliser l'API du gouvernement français (plus fiable pour les adresses françaises)
        const encodedAddress = encodeURIComponent(address);
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodedAddress}&limit=1`;

        console.log("Tentative de géolocalisation pour:", address);
        console.log("URL:", url);

        const response = await fetch(url);

        if (!response.ok) {
            console.error("Réponse API non OK:", response.status);
            throw new Error(`Erreur lors de la géolocalisation: ${response.status}`);
        }

        const data = await response.json();
        console.log("Résultat géolocalisation:", data);

        if (!data.features || data.features.length === 0) {
            console.error("Aucun résultat pour l'adresse:", address);
            throw new Error(`Adresse non trouvée: ${address}`);
        }

        const coords = data.features[0].geometry.coordinates;
        console.log("Coordonnées trouvées:", coords);

        return {
            lat: coords[1], // latitude
            lng: coords[0]  // longitude
        };
    } catch (error) {
        console.error("Erreur géolocalisation:", error);
        throw error;
    }
}

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const events = await db.collection("events").find({}).sort({ date: 1 }).toArray();

        const eventsWithStringId = events.map((e) => ({
            ...e,
            _id: e._id.toString(),
            lat: e.coords?.lat,
            lng: e.coords?.lng,
        }));

        return NextResponse.json(eventsWithStringId);
    } catch (error) {
        console.error("Erreur récupération événements:", error);
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

        // Reconstruire l'adresse complète pour la géolocalisation
        const fullAddress = `${data.rue}, ${data.codePostal} ${data.ville}`;

        // Obtenir les coordonnées GPS depuis l'adresse
        const coords = await getCoordinatesFromAddress(fullAddress);

        // Créer l'événement
        const { insertedId } = await db.collection("events").insertOne({
            name: data.name,
            address: fullAddress,
            date: data.date,
            heureDebut: data.heureDebut,
            heureFin: data.heureFin,
            coords: coords,
            createdAt: new Date(),
        });

        return NextResponse.json({
            insertedId: insertedId.toString(),
            coords: coords
        });
    } catch (error) {
        console.error("Erreur création événement:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Erreur serveur"
        }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID manquant" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const { ObjectId } = require("mongodb");
        const data = await request.json();

        // Reconstruire l'adresse complète pour la géolocalisation
        const fullAddress = `${data.rue}, ${data.codePostal} ${data.ville}`;

        // Obtenir les coordonnées GPS depuis l'adresse
        const coords = await getCoordinatesFromAddress(fullAddress);

        // Mettre à jour l'événement
        await db.collection("events").updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    name: data.name,
                    address: fullAddress,
                    date: data.date,
                    heureDebut: data.heureDebut,
                    heureFin: data.heureFin,
                    coords: coords,
                    updatedAt: new Date(),
                }
            }
        );

        return NextResponse.json({ success: true, coords: coords });
    } catch (error) {
        console.error("Erreur modification événement:", error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Erreur serveur"
        }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID manquant" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const { ObjectId } = require("mongodb");

        await db.collection("events").deleteOne({ _id: new ObjectId(id) });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur suppression événement:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
