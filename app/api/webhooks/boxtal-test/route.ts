import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const BOXTAL_WEBHOOK_SECRET = process.env.BOXTAL_TEST_SECRET || "";

function verifySignature(body: string, signature: string, secret: string): boolean {
    if (!secret) {
        console.warn("⚠️ BOXTAL_WEBHOOK_SECRET non défini");
        return true; // En test, on accepte si pas de secret configuré
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    console.log("Signature reçue:", signature);
    console.log("Signature attendue:", expectedSignature);

    return signature === expectedSignature;
}

export async function POST(req: NextRequest) {
    console.log("🔔 Test webhook POST reçu");

    // Récupérer tous les headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
        headers[key] = value;
    });
    console.log("Headers reçus:", headers);

    // Récupérer le body en tant que texte pour la vérification de signature
    const bodyText = await req.text();
    console.log("Body brut:", bodyText);

    // Vérifier la signature
    const signature = req.headers.get('x-bxt-signature') || '';
    if (BOXTAL_WEBHOOK_SECRET && signature) {
        const isValid = verifySignature(bodyText, signature, BOXTAL_WEBHOOK_SECRET);
        if (!isValid) {
            console.error("❌ Signature invalide");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
        console.log("✅ Signature valide");
    }

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
