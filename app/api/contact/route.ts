import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

const attempts = new Map<string, number[]>();
export async function POST(req: Request) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
    const now = Date.now();
    const userAttempts = attempts.get(ip) || [];
    const recentAttempts = userAttempts.filter(time => now - time < 10 * 60 * 1000);
    if (recentAttempts.length >= 3) {
        return NextResponse.json(
            { error: "Trop de tentatives. Réessayez dans 10 minutes." },
            { status: 429 }
        );
    }
    attempts.set(ip, [...recentAttempts, now]);
    const { name, email, message } = await req.json();
    const cleanData = {
        name: name?.trim(),
        email: email?.trim().toLowerCase(),
        message: message?.trim(),
    };
    if (!cleanData.name || cleanData.name.length < 2) {
        return NextResponse.json({ error: "Nom invalide (2 caractères minimum)" }, { status: 400 });
    }
    if (cleanData.name.length > 100) {
        return NextResponse.json({ error: "Nom trop long (100 caractères maximum)" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanData.email || !emailRegex.exec(cleanData.email)) {
        return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }
    if (cleanData.email.length > 254) {
        return NextResponse.json({ error: "Email trop long" }, { status: 400 });
    }
    if (!cleanData.message || cleanData.message.length < 10) {
        return NextResponse.json({ error: "Message trop court (10 caractères minimum)" }, { status: 400 });
    }
    if (cleanData.message.length > 5000) {
        return NextResponse.json({ error: "Message trop long (5000 caractères maximum)" }, { status: 400 });
    }
    const transporter = nodemailer.createTransport({
        host: 'ssl0.ovh.net',
        port: 465,
        secure: true,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASSWORD,
        },
    });
    try {
        const escapedName = cleanData.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapedEmail = cleanData.email.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapedMessage = cleanData.message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        await transporter.sendMail({
            from: process.env.MAIL_USER,
            to: process.env.MAIL_USER,
            replyTo: cleanData.email,
            subject: `Nouveau message de ${cleanData.name}`,
            html: `
                <h3>Nouveau message depuis le site EffCraft</h3>
                <p><strong>Nom :</strong> ${escapedName}</p>
                <p><strong>Email :</strong> ${escapedEmail}</p>
                <p><strong>Message :</strong></p>
                <p>${escapedMessage}</p>
            `,
        });
        return NextResponse.json({ message: "Message envoyé avec succès !" });
    } catch (error) {
        console.error("Erreur envoi email:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'envoi du message" },
            { status: 500 }
        );
    }
}