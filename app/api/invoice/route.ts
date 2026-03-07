import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import clientPromise from "../../lib/mongodb";
import { ObjectId } from "mongodb";
import { generateInvoicePdf, generateCreditNotePdf } from "../../lib/generate-invoice";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }
        const { searchParams } = new URL(req.url);
        const orderId = searchParams.get("orderId");
        const returnId = searchParams.get("returnId");

        if (!orderId) {
            return NextResponse.json({ error: "orderId manquant" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");
        const order = await db.collection("orders").findOne({ _id: new ObjectId(orderId) });
        if (!order) {
            return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
        }
        if (session.user.role !== "admin" && order.userEmail !== session.user.email) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
        }
        if (session.user.role !== "admin" && order.order?.status === "cancel_requested") {
            return NextResponse.json({ error: "Facture indisponible pendant la demande d'annulation" }, { status: 403 });
        }

        // Avoir pour un retour (depuis la collection returns)
        if (returnId) {
            const ret = await db.collection("returns").findOne({ _id: new ObjectId(returnId) });
            if (!ret) {
                return NextResponse.json({ error: "Retour introuvable" }, { status: 404 });
            }
            const refundAmount = ret.refundAmount;
            const { buffer, creditNoteNumber } = await generateCreditNotePdf(order, orderId, refundAmount);
            return new NextResponse(new Uint8Array(buffer), {
                status: 200,
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `inline; filename="avoir-${creditNoteNumber}.pdf"`,
                },
            });
        }

        // Avoir pour une annulation
        if (order.order?.status === "cancelled") {
            const refundAmount = order.order?.refundAmount;
            const { buffer, creditNoteNumber } = await generateCreditNotePdf(order, orderId, refundAmount);
            return new NextResponse(new Uint8Array(buffer), {
                status: 200,
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `inline; filename="avoir-${creditNoteNumber}.pdf"`,
                },
            });
        }

        // Facture normale
        const { buffer, invoiceNumber } = await generateInvoicePdf(order, orderId);
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="facture-${invoiceNumber}.pdf"`,
            },
        });
    } catch (error: any) {
        console.error("Erreur génération document:", error);
        return NextResponse.json(
            { error: error.message || "Erreur lors de la génération du document" },
            { status: 500 }
        );
    }
}
