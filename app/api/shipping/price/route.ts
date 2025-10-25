import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { to_address, items_count } = await request.json();
        if (!to_address || !items_count) {
            return NextResponse.json(
                { error: "Adresse et nombre d'articles requis" },
                { status: 400 }
            );
        }
        const shippingOptions = [
            {
                id: "MONR-CpourToi",
                name: "Mondial Relay",
                service: "Livraison en point relais (3 à 5 jours)",
                price: 3.90,
                priceWithTax: 3.90,
                currency: "EUR",
                logo: "/delivery/mondialRelay.webp",
                operator: "MONR",
                serviceCode: "CpourToi",
                type: "relay"
            },
            {
                id: "SOGP-RelaisColis",
                name: "Relais Colis",
                service: "Livraison en point relais (3 à 5 jours)",
                price: 4.50,
                priceWithTax: 4.50,
                currency: "EUR",
                logo: "/delivery/relayColis.webp",
                operator: "SOGP",
                serviceCode: "RelaisColis",
                type: "relay"
            },
            {
                id: "COLS-ColissimoAccess",
                name: "Colissimo",
                service: "Livraison à domicile (2 à 3 jours)",
                price: 6.50,
                priceWithTax: 6.50,
                currency: "EUR",
                logo: "/delivery/colissimo.webp",
                operator: "COLS",
                serviceCode: "ColissimoAccess",
                type: "home"
            },
            {
                id: "CHRP-Chrono13",
                name: "Chronopost",
                service: "Livraison express à domicile (48h)",
                price: 9.90,
                priceWithTax: 9.90,
                currency: "EUR",
                logo: "/delivery/chronopost.webp",
                operator: "CHRP",
                serviceCode: "Chrono13",
                type: "express"
            }
        ];
        return NextResponse.json({
            success: true,
            options: shippingOptions
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Erreur serveur lors du calcul des frais de port" },
            { status: 500 }
        );
    }
}