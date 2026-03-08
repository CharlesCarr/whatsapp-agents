import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Per-IP rate limiter for the WhatsApp webhook endpoint.
// Requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in env.
// Falls back gracefully when not configured (e.g. local dev without Upstash).
//
// NOTE: This limits by IP address since middleware can't read the request body.
// For per-sender-phone rate limiting, add the same logic inside the route handler
// where the parsed payload is available.
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: false,
      })
    : null;

export default auth(async (req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  // Webhook endpoint — apply rate limiting, skip auth
  if (pathname === "/api/webhooks/whatsapp") {
    if (req.method === "POST" && ratelimit) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const { success } = await ratelimit.limit(`webhook:${ip}`);
      if (!success) {
        return new Response(JSON.stringify({ error: "Too Many Requests" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return NextResponse.next();
  }

  // Auth routes and login page — always allow through
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // Dashboard routes — require authentication
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Run middleware on all routes except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
