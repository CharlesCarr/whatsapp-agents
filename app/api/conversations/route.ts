import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clubId = searchParams.get("clubId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  let query = db
    .from("conversations")
    .select("*, clubs!club_id(name, slug), messages(id, content, role, created_at)")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (clubId) query = query.eq("club_id", clubId);

  const { data: conversations, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(conversations);
}
