// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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
