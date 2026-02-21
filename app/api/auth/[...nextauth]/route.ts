import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
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

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        CredentialsProvider({
            id: "magic-link-credentials",
            name: "Magic Link",
            credentials: {
                email: { label: "Email", type: "email" },
                oneTimeToken: { label: "Token", type: "text" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.oneTimeToken) return null;
                const email = credentials.email.toLowerCase().trim();
                try {
                    await connectMongoose();
                    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    // Trouver l'utilisateur avec le magicSessionToken valide et le consommer
                    const dbUser = await User.findOneAndUpdate(
                        {
                            email: { $regex: new RegExp(`^${escapedEmail}$`, "i") },
                            magicSessionToken: credentials.oneTimeToken,
                            magicSessionTokenExpires: { $gt: new Date() },
                        },
                        {
                            $unset: {
                                magicSessionToken: "",
                                magicSessionTokenExpires: "",
                                magicLinkTokenUsed: "",
                            },
                        },
                        { new: true }
                    );
                    if (!dbUser) return null;
                    return {
                        id: dbUser._id.toString(),
                        email: dbUser.email,
                        name: dbUser.name,
                    };
                } catch {
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        signIn: async ({ user, account }) => {
        // Le CredentialsProvider (magic link) crée déjà le user dans authorize()
        // Pas besoin de le recréer ici
        if (account?.provider === "magic-link-credentials") return true;
        try {
            if (!user.email) throw new Error("Email utilisateur manquant");
            const email = user.email.toLowerCase().trim();
            await connectMongoose();
            // Escape les caractères spéciaux du regex (ex: le "." dans l'email)
            const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            let dbUser = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, "i") } });
            if (!dbUser) {
            dbUser = new User({
                email,
                name: user.name,
                role: adminEmails.includes(email) ? "admin" : "user",
                favorites: [],
                cart: [],
            });
            await dbUser.save();
            } else {
            let updateNeeded = false;
            if (user.name && dbUser.name !== user.name) {
                dbUser.name = user.name;
                updateNeeded = true;
            }
            const expectedRole = adminEmails.includes(email) ? "admin" : "user";
            if (dbUser.role !== expectedRole) {
                dbUser.role = expectedRole;
                updateNeeded = true;
            }
            if (updateNeeded) {
                await dbUser.save();
            }
            }
            return true;
        } catch (error) {
            console.error("[NextAuth signIn callback] Erreur:", error);
            return false;
        }
        },
        jwt: async ({ token, user }) => {
        if (user?.email) {
            const email = user.email.toLowerCase().trim();
            token.role = adminEmails.includes(email) ? "admin" : "user";
            token.firstName = user.name?.split(" ")[0] ?? null;
        }
        return token;
        },
        session: async ({ session, token }) => {
        if (session.user) {
            session.user.id = token.sub ?? "";
            session.user.role = token.role ?? "user";
            if (token.firstName) {
            session.user.name = token.firstName;
            }
        }
        return session;
        },
    },
    session: {
        strategy: "jwt",
    },
};
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
