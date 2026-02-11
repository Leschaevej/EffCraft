import { jsPDF } from "jspdf";
import path from "path";
import fs from "fs";

const FIXED_PRICES: { [key: string]: number } = {
    "MONR-CpourToi": 5.90,
    "SOGP-RelaisColis": 5.90,
    "POFR-ColissimoAccess": 9.90,
    "CHRP-Chrono18": 12.90
};
const SHIPPING_NAMES: { [key: string]: string } = {
    "MONR": "Mondial Relay",
    "SOGP": "Relais Colis",
    "POFR": "Colissimo",
    "CHRP": "Chronopost"
};

const COLORS = {
    sage: [111, 130, 106] as [number, number, number],
    dark: [36, 25, 28] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    gray: [150, 150, 150] as [number, number, number],
    grayLight: [230, 230, 230] as [number, number, number],
    tableAlt: [247, 247, 245] as [number, number, number],
};

let cachedLogo: string | null = null;

function getLogo(): string {
    if (cachedLogo) return cachedLogo;
    const logoPath = path.join(process.cwd(), "public", "logo.webp");
    const logoBuffer = fs.readFileSync(logoPath);
    cachedLogo = `data:image/webp;base64,${logoBuffer.toString("base64")}`;
    return cachedLogo;
}

export async function generateInvoicePdf(order: any, orderId: string): Promise<{ buffer: Buffer; invoiceNumber: string }> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    const invoiceDate = new Date(order.order.createdAt);
    const invoiceNumber = `FC-${invoiceDate.getFullYear()}-${orderId.slice(-6).toUpperCase()}`;

    // ===== LOGO EN HAUT À DROITE =====
    try {
        const logoData = getLogo();
        doc.addImage(logoData, "WEBP", pageWidth - margin - 38, 10, 38, 38);
    } catch (e) {
        console.error("Erreur chargement logo:", e);
    }

    // ===== TITRE "FACTURE" =====
    let y = 25;
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("FACTURE", margin, y);

    // ===== INFOS CLIENT (gauche) =====
    y = 40;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    const billing = order.billingData || order.shippingData;
    if (billing) {
        doc.text(`${(billing.prenom || "")} ${(billing.nom || "").toUpperCase()}`, margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(billing.rue || "", margin, y); y += 4.5;
        doc.text(`${billing.codePostal || ""} ${billing.ville || ""}`, margin, y); y += 4.5;
        doc.text(order.userEmail, margin, y);
    }

    // ===== INFOS FACTURE (sous le bloc client) =====
    y += 10;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    doc.text(`Date : ${invoiceDate.toLocaleDateString("fr-FR")}`, margin, y); y += 4;
    doc.text(`Facture N° : ${invoiceNumber}`, margin, y); y += 4;
    doc.text("SIRET : AJOUTER LE NUMERO", margin, y);

    // ===== INFOS ENTREPRISE (droite, sous le logo) =====
    let rightY = 54;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("EffCraft", pageWidth - margin, rightY, { align: "right" });
    rightY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.gray);
    doc.text("Elodie Forner", pageWidth - margin, rightY, { align: "right" }); rightY += 4;
    doc.text("1 bis cours d'Orbitelle", pageWidth - margin, rightY, { align: "right" }); rightY += 4;
    doc.text("13100 Aix-en-Provence", pageWidth - margin, rightY, { align: "right" }); rightY += 4;
    doc.text("contact@effcraft.fr", pageWidth - margin, rightY, { align: "right" });

    // ===== LIGNE DE SÉPARATION =====
    y = 92;
    doc.setDrawColor(...COLORS.grayLight);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    // ===== TABLEAU DES PRODUITS =====
    y = 100;
    const colDesc = margin + 3;
    const colQty = margin + contentWidth * 0.6;
    const colPrice = margin + contentWidth * 0.78;
    const colTotal = margin + contentWidth - 3;
    const rowHeight = 11;
    const headerHeight = 12;

    // Header du tableau
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.gray);
    const headerY = y + 8;
    doc.text("DESCRIPTION", colDesc, headerY);
    doc.text("QTÉ", colQty, headerY, { align: "center" });
    doc.text("PRIX UNIT.", colPrice, headerY, { align: "center" });
    doc.text("TOTAL", colTotal, headerY, { align: "right" });

    y += headerHeight;
    doc.setDrawColor(...COLORS.dark);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 1;

    // Lignes des produits
    let isAlternate = false;

    for (const product of order.products) {
        if (isAlternate) {
            doc.setFillColor(...COLORS.tableAlt);
            doc.rect(margin, y, contentWidth, rowHeight, "F");
        }

        const textY = y + 7.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.dark);
        doc.text(product.name, colDesc, textY);
        doc.text("1", colQty, textY, { align: "center" });
        doc.text(`${product.price.toFixed(2)} €`, colPrice, textY, { align: "center" });
        doc.text(`${product.price.toFixed(2)} €`, colTotal, textY, { align: "right" });

        y += rowHeight;
        isAlternate = !isAlternate;
    }

    // Ligne de fin du tableau
    doc.setDrawColor(...COLORS.grayLight);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    // ===== BLOC RÉCAPITULATIF (bas droite) =====
    y += 10;
    const summaryX = margin + contentWidth * 0.58;
    const summaryLabelX = summaryX;
    const summaryValueX = margin + contentWidth;
    const summaryRowH = 7;

    const shippingCode = `${order.shippingData?.shippingMethod?.operator || "MONR"}-${order.shippingData?.shippingMethod?.serviceCode || "CpourToi"}`;
    const shippingCost = FIXED_PRICES[shippingCode] || 5.90;
    const shippingName = SHIPPING_NAMES[order.shippingData?.shippingMethod?.operator] || "Standard";
    const productsTotal = order.products.reduce((sum: number, p: any) => sum + p.price, 0);

    // Sous-total
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    doc.text("Sous-total", summaryLabelX, y);
    doc.setTextColor(...COLORS.dark);
    doc.text(`${productsTotal.toFixed(2)} €`, summaryValueX, y, { align: "right" });
    y += summaryRowH;

    // Livraison
    doc.setTextColor(...COLORS.gray);
    doc.text(`Livraison (${shippingName})`, summaryLabelX, y);
    doc.setTextColor(...COLORS.dark);
    doc.text(`${shippingCost.toFixed(2)} €`, summaryValueX, y, { align: "right" });
    y += summaryRowH;

    // TVA
    doc.setTextColor(...COLORS.gray);
    doc.text("TVA", summaryLabelX, y);
    doc.setTextColor(...COLORS.dark);
    doc.text("0,00 €", summaryValueX, y, { align: "right" });
    y += summaryRowH + 2;

    // Ligne avant le total
    doc.setDrawColor(...COLORS.grayLight);
    doc.setLineWidth(0.3);
    doc.line(summaryX, y - 1, pageWidth - margin, y - 1);

    // Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.dark);
    doc.text("Total", summaryLabelX, y + 5);
    doc.text(`${order.order.totalPrice.toFixed(2)} €`, summaryValueX, y + 5, { align: "right" });

    // ===== INFOS PAIEMENT (bas gauche, aligné avec le récap) =====
    const paymentStartY = y - (summaryRowH * 3 + 2) + 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.gray);
    doc.text("Paiement : Carte bancaire (Stripe)", margin, paymentStartY);
    doc.text(`Livraison : ${shippingName}`, margin, paymentStartY + 5);

    // ===== MESSAGE DE REMERCIEMENT =====
    y += 20;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.sage);
    doc.text("Merci pour votre commande !", margin, y);

    // ===== MENTION TVA =====
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text("TVA non applicable, art. 293 B du CGI", margin, y);

    // ===== FOOTER =====
    const footerY = pageHeight - 16;
    doc.setDrawColor(...COLORS.grayLight);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    doc.text(
        "EffCraft - Elodie Forner - 1 bis cours d'Orbitelle, 13100 Aix-en-Provence - contact@effcraft.fr",
        pageWidth / 2,
        footerY + 5,
        { align: "center" }
    );

    const buffer = Buffer.from(doc.output("arraybuffer"));
    return { buffer, invoiceNumber };
}
