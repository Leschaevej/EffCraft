import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import mongoose from "mongoose";
import clientPromise from "../../../lib/mongodb";
import User from "../../../lib/models/User";

const adminEmails = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
  : [];
export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        signIn: async ({ user }) => {
        try {
            if (!user.email) throw new Error("Email utilisateur manquant");
            await clientPromise;
            if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI!, {
                bufferCommands: false,
                serverSelectionTimeoutMS: 10000,
            });
            }
            let dbUser = await User.findOne({ email: user.email });
            if (!dbUser) {
            dbUser = new User({
                email: user.email,
                name: user.name,
                role: adminEmails.includes(user.email) ? "admin" : "user",
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
            const expectedRole = adminEmails.includes(user.email) ? "admin" : "user";
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
            console.error("Erreur signIn:", error);
            return false;
        }
        },
        jwt: async ({ token, user }) => {
        if (user?.email) {
            token.role = adminEmails.includes(user.email) ? "admin" : "user";
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