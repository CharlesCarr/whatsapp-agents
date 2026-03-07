import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const GroupSchema = z.object({
  group_id: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: club_id } = await params;
  const body = await req.json();
  const parsed = GroupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: group, error } = await db
    .from("whatsapp_groups")
    .upsert({ club_id, group_id: parsed.data.group_id }, { onConflict: "group_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(group, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: club_id } = await params;
  const { data: groups, error } = await db
    .from("whatsapp_groups")
    .select("*")
    .eq("club_id", club_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(groups);
}
