import { loadStripe, Stripe as StripeJS } from "@stripe/stripe-js";

const isTestMode = process.env.NEXT_PUBLIC_STRIPE_ENV === "test";
const stripePublishableKey = isTestMode
    ? process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY
    : process.env.NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY;

let stripePromise: Promise<StripeJS | null> | null = null;
export const getStripePromise = () => {
    if (!stripePromise && stripePublishableKey) {
        stripePromise = loadStripe(stripePublishableKey);
    }
    return stripePromise;
};