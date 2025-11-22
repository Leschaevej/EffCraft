import { NextRequest, NextResponse } from "next/server";

// Endpoint temporaire ultra-simple pour validation Boxtal
export async function POST(req: NextRequest) {
    console.log("🔔 Test webhook reçu");
    const body = await req.json().catch(() => ({}));
    console.log("Body:", body);
    return NextResponse.json({ success: true }, { status: 200 });
}

export async function GET(req: NextRequest) {
    console.log("🔔 Test webhook GET reçu");
    return NextResponse.json({ success: true, message: "Webhook endpoint ready" }, { status: 200 });
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
