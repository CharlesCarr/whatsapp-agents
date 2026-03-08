import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req: NextRequest & { auth: unknown }) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = {
  // Protect all routes except: public API endpoints, auth routes, login page, and Next.js internals
  matcher: [
    "/((?!api/webhooks|api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
