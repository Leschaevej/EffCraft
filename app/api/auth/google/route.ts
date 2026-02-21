import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]/route";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../../../lib/models/User";

async function connectMongoose() {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI!, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000,
        });
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return new NextResponse(
                `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<script>
if (window.opener) {
    window.opener.postMessage({ type: "google-signed-in", error: "no-session" }, window.location.origin);
}
window.close();
</script>
</body></html>`,
                { headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
        }

        await connectMongoose();

        const email = session.user.email.toLowerCase().trim();
        const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const dbUser = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, "i") } });

        if (!dbUser) {
            return new NextResponse(
                `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<script>
if (window.opener) {
    window.opener.postMessage({ type: "google-signed-in", error: "no-user" }, window.location.origin);
}
window.close();
</script>
</body></html>`,
                { headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
        }

        const oneTimeToken = crypto.randomBytes(32).toString("hex");
        await User.updateOne(
            { _id: dbUser._id },
            {
                $set: {
                    magicSessionToken: oneTimeToken,
                    magicSessionTokenExpires: new Date(Date.now() + 60 * 1000),
                },
            }
        );

        return new NextResponse(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<script>
if (window.opener) {
    window.opener.postMessage({ type: "google-signed-in", email: ${JSON.stringify(email)}, oneTimeToken: ${JSON.stringify(oneTimeToken)} }, window.location.origin);
}
window.close();
</script>
</body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    } catch {
        return new NextResponse(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<script>
if (window.opener) {
    window.opener.postMessage({ type: "google-signed-in", error: "server-error" }, window.location.origin);
}
window.close();
</script>
</body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    }
}
