import { NextRequest, NextResponse } from "next/server";
import clientPromise from "../../../lib/mongodb";
import pusherServer from "../../../lib/pusher-server";
import nodemailer from "nodemailer";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../../../lib/models/User";

const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : [];

// POST : génère et envoie le lien magique
export async function POST(req: Request) {
    try {
        const { email, callbackUrl } = await req.json();
        if (!email || !email.includes("@")) {
            return NextResponse.json({ error: "Email invalide" }, { status: 400 });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");

        await db.collection("magic_link_tokens").insertOne({
            email: email.toLowerCase().trim(),
            token,
            expires,
            used: false,
            callbackUrl: callbackUrl || "/",
            createdAt: new Date(),
        });

        const baseUrl = process.env.NEXTAUTH_URL || "https://effcraft.fr";
        const magicUrl = `${baseUrl}/api/auth/magic-link?token=${token}`;

        const transporter = nodemailer.createTransport({
            host: "ssl0.ovh.net",
            port: 465,
            secure: true,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"EffCraft" <${process.env.MAIL_USER}>`,
            to: email,
            subject: "Votre lien de connexion EffCraft",
            headers: {
                "X-Mailer": "EffCraft Mailer",
                "Organization": "EffCraft",
            },
            html: `
                <h2>Connexion à EffCraft</h2>
                <p>Bonjour,</p>
                <p>Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable <strong>10 minutes</strong>.</p>
                <p style="text-align:center;margin:32px 0;">
                    <a href="${magicUrl}" style="background:#000;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:16px;">
                        Se connecter
                    </a>
                </p>
                <p style="color:#888;font-size:13px;">Si vous n'avez pas demandé ce lien, ignorez cet email.</p>
                <p>Cordialement,<br>L'équipe EffCraft</p>
            `,
        });

        return NextResponse.json({ message: "Lien envoyé" });
    } catch (error) {
        console.error("Erreur magic link:", error);
        return NextResponse.json({ error: "Erreur lors de l'envoi" }, { status: 500 });
    }
}

// GET : vérifie le token, crée la session NextAuth, redirige vers la page d'origine
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token");
        const baseUrl = process.env.NEXTAUTH_URL || "https://effcraft.fr";

        const pageHtml = (message: string, isError = false) => new NextResponse(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#F8E7C8;color:#24191C;text-align:center;gap:20px;}
img{width:120px;opacity:0.9;}
p{font-size:18px;font-weight:600;color:${isError ? "#a51f08" : "#6F826A"};}
small{font-size:13px;opacity:0.5;}
</style></head><body>
<img src="/logo.webp" alt="Eff Craft"/>
<p>${message}</p>
<small>Cet onglet va se fermer...</small>
<script>setTimeout(()=>window.close(),3000);</script>
</body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );

        if (!token) {
            return pageHtml("Lien invalide.", true);
        }

        const client = await clientPromise;
        const db = client.db("effcraftdatabase");

        const record = await db.collection("magic_link_tokens").findOne({
            token,
            used: false,
            expires: { $gt: new Date() },
        });

        if (!record) {
            return pageHtml("Ce lien a déjà été utilisé ou a expiré.", true);
        }

        // Marquer le token comme utilisé
        await db.collection("magic_link_tokens").updateOne(
            { token },
            { $set: { used: true } }
        );

        const email = record.email;
        const callbackUrl = record.callbackUrl || "/";

        // Créer l'utilisateur s'il n'existe pas
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI!, {
                bufferCommands: false,
                serverSelectionTimeoutMS: 10000,
            });
        }
        let dbUser = await User.findOne({ email });
        if (!dbUser) {
            dbUser = new User({
                email,
                name: email.split("@")[0],
                role: adminEmails.includes(email) ? "admin" : "user",
                favorites: [],
                cart: [],
            });
            await dbUser.save();
        }

        // Générer un one-time token valable 60 secondes pour que le Header se connecte
        const oneTimeToken = crypto.randomBytes(32).toString("hex");
        await db.collection("magic_session_tokens").insertOne({
            token: oneTimeToken,
            email,
            expires: new Date(Date.now() + 60 * 1000),
            createdAt: new Date(),
        });

        // Envoyer via Pusher pour que l'onglet original se connecte
        await pusherServer.trigger("effcraft-channel", "magic_link_signed_in", {
            email,
            oneTimeToken,
        });

        return pageHtml("Connexion réussie !");
    } catch (error) {
        console.error("Erreur vérification magic link:", error);
        return new NextResponse(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#F8E7C8;color:#24191C;text-align:center;gap:20px;}
img{width:120px;opacity:0.9;}
p{font-size:18px;font-weight:600;color:#a51f08;}
small{font-size:13px;opacity:0.5;}
</style></head><body>
<img src="/logo.webp" alt="Eff Craft"/>
<p>Une erreur est survenue.</p>
<small>Cet onglet va se fermer...</small>
<script>setTimeout(()=>window.close(),3000);</script>
</body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    }
}
