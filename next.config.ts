import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for instrumentation.ts (Sentry, OpenTelemetry, etc.) to load
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
