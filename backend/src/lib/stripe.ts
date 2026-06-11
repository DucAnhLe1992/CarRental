import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

// Single shared Stripe client. The SDK uses the latest API version by default.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
