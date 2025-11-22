import { NextRequest, NextResponse } from "next/server";

// Endpoint temporaire ultra-simple pour validation Boxtal
export async function POST(req: NextRequest) {
    console.log("🔔 Test webhook reçu");
    return NextResponse.json({ success: true }, { status: 200 });
}

export async function GET(req: NextRequest) {
    console.log("🔔 Test webhook GET reçu");
    return NextResponse.json({ success: true, message: "Webhook endpoint ready" }, { status: 200 });
}
