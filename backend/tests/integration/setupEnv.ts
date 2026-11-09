import { inject } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATABASE_SSL = "false";
// PGlite is a single Postgres session, so its pool must hold one connection to keep transactions isolated.
if (inject("usingEmbeddedDatabase")) process.env.DATABASE_POOL_MAX = "1";
process.env.JWT_SECRET = "integration-test-secret-that-is-long-enough";
process.env.STRIPE_SECRET_KEY = "sk_test_integration_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_integration_test_secret";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
