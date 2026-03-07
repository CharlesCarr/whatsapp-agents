import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Json } from "@/lib/db/database.types";
import { z } from "zod";

const ClubSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  whatsapp_number: z.string().min(10),
  booking_platform: z.enum(["COURTRESERVE", "PLAYTOMIC", "CUSTOM"]),
  booking_config: z.record(z.string(), z.unknown()),
  agent_config: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET() {
  const { data: clubs, error } = await db
    .from("clubs")
    .select("*, whatsapp_groups(*)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(clubs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ClubSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { booking_config, agent_config, ...rest } = parsed.data;
  const { data: club, error } = await db
    .from("clubs")
    .insert({
      ...rest,
      booking_config: booking_config as unknown as Json,
      agent_config: agent_config as unknown as Json,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(club, { status: 201 });
}
