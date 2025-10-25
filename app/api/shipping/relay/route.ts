import { NextRequest, NextResponse } from "next/server";

const getBoxtalApiUrl = () => {
    return process.env.BOXTAL_ENV === "production"
        ? "https://api.boxtal.com"
        : "https://api.boxtal.build";
};
export async function POST(request: NextRequest) {
    try {
        const { address, zipcode, city, country, carrier } = await request.json();
        if (!zipcode || !city || !country) {
            return NextResponse.json(
                { error: "Code postal, ville et pays requis" },
                { status: 400 }
            );
        }
        const isProduction = process.env.BOXTAL_ENV === "production";
        const apiKey = isProduction ? process.env.BOXTAL_V3_PROD_KEY : process.env.BOXTAL_V3_TEST_KEY;
        const apiSecret = isProduction ? process.env.BOXTAL_V3_PROD_SECRET : process.env.BOXTAL_V3_TEST_SECRET;
        const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const carrierToNetwork: { [key: string]: string } = {
            "MONR": "MONR_NETWORK",
            "SOGP": "SOGP_NETWORK",
            "CHRP": "CHRP_NETWORK",
            "COPR": "COPR_NETWORK"
        };
        const params = new URLSearchParams({
            countryIsoCode: country,
            postalCode: zipcode,
            city: city,
        });
        if (address) {
            const streetParts = address.split(' ');
            if (streetParts.length > 1) {
                params.append("number", streetParts[0]);
                params.append("street", streetParts.slice(1).join(' '));
            } else {
                params.append("street", address);
            }
        }
        if (carrier && carrierToNetwork[carrier]) {
            params.append("searchNetworks", carrierToNetwork[carrier]);
        } else {
            params.append("searchNetworks", "MONR_NETWORK");
            params.append("searchNetworks", "SOGP_NETWORK");
        }
        const apiUrl = getBoxtalApiUrl();
        const response = await fetch(`${apiUrl}/shipping/v3.2/parcel-point-by-network?${params.toString()}`, {
            method: "GET",
            headers: {
                "Authorization": `Basic ${authString}`,
                "Accept": "application/json"
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: "Erreur lors de la récupération des points relais", details: errorText },
                { status: response.status }
            );
        }
        const data = await response.json();
        const parcelPoints = (data.content || []).map((item: any) => {
            const point = item.parcelPoint || item;
            const location = point?.location;
            if (!point || !location) {
                return null;
            }
            return {
                id: point.code,
                name: point.name,
                address: `${location.number || ''} ${location.street || ''}`.trim(),
                zipcode: location.postalCode,
                city: location.city,
                country: location.countryIsoCode,
                latitude: parseFloat(location.position?.latitude || 0),
                longitude: parseFloat(location.position?.longitude || 0),
                carrier: point.compatibleNetworks?.[0] || carrier,
                openingHours: point.openingDays,
                distance: item.distanceFromSearchLocation
            };
        }).filter((point: any) => point !== null);
        return NextResponse.json({
            success: true,
            points: parcelPoints
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Erreur serveur lors de la récupération des points relais" },
            { status: 500 }
        );
    }
}