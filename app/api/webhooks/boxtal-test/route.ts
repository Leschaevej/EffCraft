import { NextRequest, NextResponse } from "next/server";

const BOXTAL_WEBHOOK_TOKEN = process.env.BOXTAL_WEBHOOK_TOKEN || "";

export async function POST(req: NextRequest) {
    console.log("🔔 Test webhook POST reçu");

    // Vérifier le token dans l'URL
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token || token !== BOXTAL_WEBHOOK_TOKEN) {
        console.error("❌ Token invalide ou manquant");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("✅ Token validé");

    // Récupérer le body
    const bodyText = await req.text();

    // Parser le body
    let body;
    try {
        body = JSON.parse(bodyText);
        console.log("Body parsé:", body);
    } catch (e) {
        console.log("Body non-JSON:", bodyText);
    }

    return NextResponse.json({ success: true, received: true }, { status: 200 });
}

export async function GET(req: NextRequest) {
    console.log("🔔 Test webhook GET reçu");
    return NextResponse.json({
        success: true,
        message: "Webhook endpoint ready",
        hasSecret: !!BOXTAL_WEBHOOK_SECRET
    }, { status: 200 });
}

export async function HEAD(req: NextRequest) {
    console.log("🔔 Test webhook HEAD reçu");
    return new NextResponse(null, { status: 200 });
}

export async function PUT(req: NextRequest) {
    console.log("🔔 Test webhook PUT reçu");
    return NextResponse.json({ success: true }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
    console.log("🔔 Test webhook PATCH reçu");
    return NextResponse.json({ success: true }, { status: 200 });
}
