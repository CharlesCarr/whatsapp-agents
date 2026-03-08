// This file configures the initialization of Sentry on the server side.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust tracesSampleRate in production — 1.0 = 100% of transactions captured
  tracesSampleRate: 1.0,

  // Enable source maps for readable stack traces in the Sentry dashboard
  // (Vercel/Next.js will upload source maps automatically with SENTRY_AUTH_TOKEN set)
  debug: process.env.NODE_ENV === "development",
});
