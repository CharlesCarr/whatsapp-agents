import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — lightweight liveness check for uptime monitors
// No auth required. Returns 503 if the DB is unreachable.
export async function GET() {
  const ts = new Date().toISOString();
  try {
    const { error } = await db.from("clubs").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", db: "ok", ts });
  } catch {
    return NextResponse.json({ status: "error", db: "error", ts }, { status: 503 });
  }
}
