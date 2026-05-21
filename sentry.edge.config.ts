// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://e0b0fbd7e37839c48b6f954b2e0d738e@o4511429705465856.ingest.us.sentry.io/4511429705662464",

  // 10% trace sampling in production to stay within quota; full sampling in dev.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // PII (user IP / headers / email) is NOT sent — conservative default for a
  // portal handling PM + resident data. Flip to true for richer debugging.
  sendDefaultPii: false,
});
