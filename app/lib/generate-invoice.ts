import { jsPDF } from "jspdf";

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
export function generateInvoicePdf(order: any, orderId: string): { buffer: Buffer; invoiceNumber: string } {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("EffCraft", margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Elodie Forner", margin, y); y += 4;
    doc.text("1 bis cours d'Orbitelle", margin, y); y += 4;
    doc.text("13100 Aix-en-Provence", margin, y); y += 4;
    doc.text("contact@effcraft.fr", margin, y); y += 4;
    doc.text("SIRET : AJOUTER LE NUMERO", margin, y); y += 4;
    doc.text("TVA non applicable, art. 293 B du CGI", margin, y);
    const invoiceDate = new Date(order.order.createdAt);
    const invoiceNumber = `FC-${invoiceDate.getFullYear()}-${orderId.slice(-6).toUpperCase()}`;
    y = 20;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Facture ${invoiceNumber}`, pageWidth - margin, y, { align: "right" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Date : ${invoiceDate.toLocaleDateString("fr-FR")}`, pageWidth - margin, y, { align: "right" });
    y = 65;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Facturer à :", pageWidth - margin - 60, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const billing = order.billingData || order.shippingData;
    if (billing) {
        doc.text(`${billing.prenom || ""} ${billing.nom || ""}`, pageWidth - margin - 60, y); y += 4;
        doc.text(billing.rue || "", pageWidth - margin - 60, y); y += 4;
        doc.text(`${billing.codePostal || ""} ${billing.ville || ""}`, pageWidth - margin - 60, y); y += 4;
    }
    doc.text(order.userEmail, pageWidth - margin - 60, y);
    y = 100;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    const colX = {
        desc: margin,
        qty: pageWidth - margin - 60,
        price: pageWidth - margin - 30,
        total: pageWidth - margin
    };
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Description", colX.desc, y);
    doc.text("Qté", colX.qty, y, { align: "right" });
    doc.text("Prix unit.", colX.price, y, { align: "right" });
    doc.text("Total", colX.total, y, { align: "right" });
    y += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    for (const product of order.products) {
        doc.text(product.name, colX.desc, y);
        doc.text("1", colX.qty, y, { align: "right" });
        doc.text(`${product.price.toFixed(2)} €`, colX.price, y, { align: "right" });
        doc.text(`${product.price.toFixed(2)} €`, colX.total, y, { align: "right" });
        y += 7;
    }
    const shippingCode = `${order.shippingData?.shippingMethod?.operator || "MONR"}-${order.shippingData?.shippingMethod?.serviceCode || "CpourToi"}`;
    const shippingCost = FIXED_PRICES[shippingCode] || 5.90;
    doc.text("Frais de livraison", colX.desc, y);
    doc.text("1", colX.qty, y, { align: "right" });
    doc.text(`${shippingCost.toFixed(2)} €`, colX.price, y, { align: "right" });
    doc.text(`${shippingCost.toFixed(2)} €`, colX.total, y, { align: "right" });
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Total TTC :", colX.price - 10, y, { align: "right" });
    doc.text(`${order.order.totalPrice.toFixed(2)} €`, colX.total, y, { align: "right" });
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("TVA non applicable, art. 293 B du CGI", colX.price - 10, y, { align: "right" });
    y += 15;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Moyen de paiement : Carte bancaire (Stripe)", margin, y);
    y += 6;
    const shippingName = SHIPPING_NAMES[order.shippingData?.shippingMethod?.operator] || "Standard";
    doc.text(`Mode de livraison : ${shippingName}`, margin, y);
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(7);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.text(
        "EffCraft - Elodie Forner - 1 bis cours d'Orbitelle, 13100 Aix-en-Provence - contact@effcraft.fr - SIRET : AJOUTER LE NUMERO",
        pageWidth / 2,
        footerY,
        { align: "center" }
    );

    const buffer = Buffer.from(doc.output("arraybuffer"));
    return { buffer, invoiceNumber };
}