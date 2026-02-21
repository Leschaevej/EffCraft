import { NextRequest, NextResponse } from "next/server";
import pusherServer from "../../../lib/pusher-server";
import nodemailer from "nodemailer";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../../../lib/models/User";

const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
    : [];

async function connectMongoose() {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000,
        });
    }
}

// POST : génère et envoie le lien magique
export async function POST(req: Request) {
    try {
        const { email, callbackUrl } = await req.json();
        if (!email || !email.includes("@")) {
            return NextResponse.json({ error: "Email invalide" }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await connectMongoose();

        // Chercher le user existant (insensible à la casse)
        const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        let dbUser = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, "i") } });
        if (dbUser) {
            // User existant : stocker le token
            dbUser.magicLinkToken = token;
            dbUser.magicLinkTokenExpires = expires;
            dbUser.magicLinkTokenUsed = false;
            dbUser.magicLinkCallbackUrl = callbackUrl || "/";
            await dbUser.save();
        } else {
            // Nouveau user : créer avec le token
            dbUser = new User({
                email: normalizedEmail,
                name: normalizedEmail.split("@")[0],
                role: adminEmails.includes(normalizedEmail) ? "admin" : "user",
                favorites: [],
                cart: [],
                magicLinkToken: token,
                magicLinkTokenExpires: expires,
                magicLinkTokenUsed: false,
                magicLinkCallbackUrl: callbackUrl || "/",
            });
            await dbUser.save();
        }

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

// GET : vérifie le token, génère un oneTimeToken via Pusher, ferme l'onglet
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token");

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

        await connectMongoose();

        // Trouver l'utilisateur avec ce token valide et non utilisé
        // On accepte magicLinkTokenUsed: false OU le champ absent (undefined)
        const dbUser = await User.findOne({
            magicLinkToken: token,
            magicLinkTokenUsed: { $ne: true },
            magicLinkTokenExpires: { $gt: new Date() },
        });

        if (!dbUser) {
            return pageHtml("Ce lien a déjà été utilisé ou a expiré.", true);
        }

        const email = dbUser.email;

        // Générer un one-time token valable 60 secondes
        const oneTimeToken = crypto.randomBytes(32).toString("hex");
        await User.updateOne(
            { _id: dbUser._id },
            {
                $set: {
                    magicSessionToken: oneTimeToken,
                    magicSessionTokenExpires: new Date(Date.now() + 60 * 1000),
                    magicLinkTokenUsed: true,
                },
                $unset: {
                    magicLinkToken: "",
                    magicLinkTokenExpires: "",
                    magicLinkCallbackUrl: "",
                },
            }
        );

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
