import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Json } from "@/lib/db/database.types";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  whatsapp_number: z.string().min(10).optional(),
  booking_platform: z.enum(["COURTRESERVE", "PLAYTOMIC", "CUSTOM"]).optional(),
  booking_config: z.record(z.string(), z.unknown()).optional(),
  agent_config: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: club, error } = await db
    .from("clubs")
    .select("*, whatsapp_groups(*)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(club);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { booking_config, agent_config, ...rest } = parsed.data;
  const { data: club, error } = await db
    .from("clubs")
    .update({
      ...rest,
      ...(booking_config ? { booking_config: booking_config as unknown as Json } : {}),
      ...(agent_config ? { agent_config: agent_config as unknown as Json } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(club);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await db.from("clubs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
