import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

// withSentryConfig uploads source maps on production builds so stack traces in
// the Sentry dashboard are human-readable. Set SENTRY_ORG, SENTRY_PROJECT, and
// SENTRY_AUTH_TOKEN in Vercel env vars (not needed for local dev).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
