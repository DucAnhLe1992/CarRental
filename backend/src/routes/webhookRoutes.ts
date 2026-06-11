import { Router } from "express";
import express from "express";
import { handleStripeWebhook } from "../controllers/webhookController.js";

const webhookRoutes = Router();

// express.raw() is required here so that stripe.webhooks.constructEvent()
// can verify the Stripe signature against the original request body bytes.
// This route must be mounted in app.ts BEFORE express.json() is applied globally.
webhookRoutes.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

export default webhookRoutes;
