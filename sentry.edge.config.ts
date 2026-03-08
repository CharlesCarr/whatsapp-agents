// This file configures the initialization of Sentry for edge runtimes.
// The config you add here will be used whenever the Edge runtime handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: 1.0,

  debug: process.env.NODE_ENV === "development",
});
