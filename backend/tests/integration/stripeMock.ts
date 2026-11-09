import { vi } from "vitest";
import type { CheckoutRequest } from "../../src/services/paymentService.js";

let sessionCounter = 0;

export const stripeMock = {
  createCheckoutSession: vi.fn(async (input: CheckoutRequest) => {
    sessionCounter += 1;
    const id = `cs_test_${input.bookingId}_${sessionCounter}`;
    return { id, url: `https://checkout.stripe.test/${id}` };
  }),
  getCheckoutSessionState: vi.fn(async () => ({ state: "expired" as const })),
  expireCheckoutSession: vi.fn(async () => {}),
  refundPayment: vi.fn(async (bookingId: number) => ({ id: `re_test_${bookingId}`, status: "pending" })),
};
