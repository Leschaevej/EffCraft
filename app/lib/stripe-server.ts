import Stripe from "stripe";

const isTestMode = process.env.STRIPE_ENV === "test";
const stripeSecretKey = isTestMode
    ? process.env.STRIPE_TEST_SECRET_KEY!
    : process.env.STRIPE_PROD_SECRET_KEY!;
console.log("🔑 Stripe Server - Clé utilisée:", stripeSecretKey?.substring(0, 15) + "...");
console.log("📍 Stripe Server - Mode:", isTestMode ? "TEST" : "PRODUCTION");
export const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-09-30.clover" as any,
});