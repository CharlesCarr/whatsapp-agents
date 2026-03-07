import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: conversation, error } = await db
    .from("conversations")
    .select("*, clubs!club_id(name, slug), messages(*)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sort messages by created_at ascending
  if (conversation.messages) {
    conversation.messages.sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  return NextResponse.json(conversation);
}
