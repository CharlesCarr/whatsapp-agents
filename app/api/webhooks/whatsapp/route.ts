import { NextRequest, NextResponse } from "next/server";
import { parseWebhook, verifyWebhookChallenge, sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { db } from "@/lib/db";
import { runAgent } from "@/lib/agent/conversation";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";
import type { Club } from "@/lib/db/types";

// GET — webhook verification (Meta / 360dialog challenge-response)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const challenge = verifyWebhookChallenge({
    mode: searchParams.get("hub.mode") ?? "",
    token: searchParams.get("hub.verify_token") ?? "",
    challenge: searchParams.get("hub.challenge") ?? "",
  });

  if (challenge) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — incoming WhatsApp messages
export async function POST(req: NextRequest) {
  let payload: WhatsAppWebhookPayload;
  try {
    payload = await req.json() as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Acknowledge immediately — WhatsApp requires <5s response
  handleMessages(payload).catch((err) => {
    console.error("[webhook] processing error:", err);
  });

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

async function handleMessages(payload: WhatsAppWebhookPayload) {
  const messages = parseWebhook(payload);

  for (const msg of messages) {
    try {
      const club = await resolveClub(msg.from, msg.groupId);
      if (!club) {
        console.warn(`[webhook] No club found for sender ${msg.from} group ${msg.groupId}`);
        continue;
      }

      const response = await runAgent({
        clubId: club.id,
        waContactId: msg.from,
        waGroupId: msg.groupId,
        incomingText: msg.text,
        playerName: msg.senderName,
      });

      await sendWhatsAppMessage(msg.from, response);
    } catch (err) {
      console.error(`[webhook] Error handling message from ${msg.from}:`, err);
    }
  }
}

async function resolveClub(senderPhone: string, groupId?: string): Promise<Club | null> {
  // Group message → look up by group ID
  if (groupId) {
    const { data: group } = await db
      .from("whatsapp_groups")
      .select("*, clubs!club_id(*)")
      .eq("group_id", groupId)
      .single();

    const club = group?.clubs as Club | undefined;
    if (club?.is_active) return club;
  }

  // DM → fall back to first active club (single-club setup)
  // TODO: route by the receiving phone number from webhook metadata for multi-club
  const { data: club } = await db
    .from("clubs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return club ?? null;
}
