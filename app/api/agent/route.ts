import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/conversation";
import { z } from "zod";

const TestSchema = z.object({
  clubId: z.string().min(1),
  waContactId: z.string().min(1),
  waGroupId: z.string().optional(),
  message: z.string().min(1),
  playerName: z.string().optional(),
});

// Debug/test endpoint — sends a message through the agent without WhatsApp
// Useful during local development with ngrok
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = TestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { clubId, waContactId, waGroupId, message, playerName } = parsed.data;

  try {
    const response = await runAgent({
      clubId,
      waContactId,
      waGroupId,
      incomingText: message,
      playerName,
    });
    return NextResponse.json({ response });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ error: errMessage, stack }, { status: 500 });
  }
}
