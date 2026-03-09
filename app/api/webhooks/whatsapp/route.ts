import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { parseWebhook, verifyWebhookChallenge, verifySignature, sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { db } from "@/lib/db";
import { runAgent } from "@/lib/agent/conversation";
import { log } from "@/lib/logger";
import { Redis } from "@upstash/redis";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";
import type { Club } from "@/lib/db/types";

// Upstash Redis client — graceful no-op when not configured (same pattern as rate limiting)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "opt out", "optout"];
const OPT_IN_KEYWORDS = ["start", "yes", "subscribe"];

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
  const rawBody = await req.text();

  // HMAC signature verification — skip in development if secret is not configured
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    if (!verifySignature(rawBody, signature, appSecret)) {
      log.warn("[webhook] Invalid HMAC signature — request rejected");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (process.env.NODE_ENV !== "development") {
    log.error("[webhook] WHATSAPP_APP_SECRET not set — rejecting request");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Acknowledge immediately — WhatsApp requires <5s response
  // waitUntil keeps the Vercel function alive until processing completes
  waitUntil(
    handleMessages(payload).catch((err) => {
      log.error("[webhook] processing error", { error: String(err) });
    })
  );

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

async function handleMessages(payload: WhatsAppWebhookPayload) {
  const messages = parseWebhook(payload);

  for (const msg of messages) {
    try {
      // Non-text messages (images, audio, video, etc.) — reply with a canned message
      if (msg.text === "__NON_TEXT__") {
        await sendWhatsAppMessage(
          msg.from,
          "Sorry, I can only handle text messages. Please type your request."
        );
        continue;
      }

      const normalized = msg.text.trim().toLowerCase();

      const club = await resolveClub(msg.from, msg.groupId, msg.receivingNumberId);
      if (!club) {
        log.warn("[webhook] No club found for sender", { from: msg.from, groupId: msg.groupId });
        continue;
      }

      // Opt-out keyword — mark opted out, reply, skip agent
      if (OPT_OUT_KEYWORDS.includes(normalized)) {
        await db
          .from("conversations")
          .update({ opted_out_at: new Date().toISOString() })
          .eq("wa_contact_id", msg.from)
          .eq("club_id", club.id);
        await sendWhatsAppMessage(
          msg.from,
          "You've been unsubscribed. Reply START to re-subscribe."
        );
        log.info("[webhook] contact opted out", { from: msg.from, clubId: club.id });
        continue;
      }

      // Check if this contact is currently opted out for this club
      const { data: optedOutConv } = await db
        .from("conversations")
        .select("opted_out_at")
        .eq("wa_contact_id", msg.from)
        .eq("club_id", club.id)
        .not("opted_out_at", "is", null)
        .maybeSingle();

      if (optedOutConv) {
        if (OPT_IN_KEYWORDS.includes(normalized)) {
          // Re-subscribe: clear opted_out_at and send welcome back
          await db
            .from("conversations")
            .update({ opted_out_at: null })
            .eq("wa_contact_id", msg.from)
            .eq("club_id", club.id);
          await sendWhatsAppMessage(
            msg.from,
            "Welcome back! How can I help you book a court today?"
          );
          log.info("[webhook] contact re-subscribed", { from: msg.from, clubId: club.id });
        }
        // else: silently skip — per Meta policy do not reply to opted-out contacts
        continue;
      }

      // RESET command — clear conversation history so next message starts fresh
      if (normalized === "reset" || normalized === "start over") {
        let convQuery = db
          .from("conversations")
          .select("id")
          .eq("club_id", club.id)
          .eq("wa_contact_id", msg.from);
        convQuery = msg.groupId
          ? convQuery.eq("wa_group_id", msg.groupId)
          : convQuery.is("wa_group_id", null);
        const { data: resetConv } = await convQuery.maybeSingle();
        if (resetConv) {
          await db.from("messages").delete().eq("conversation_id", resetConv.id);
          await db
            .from("conversations")
            .update({ last_message_at: null })
            .eq("id", resetConv.id);
        }
        await sendWhatsAppMessage(msg.from, "Conversation reset. How can I help you today?");
        log.info("[webhook] conversation reset", { from: msg.from, clubId: club.id });
        continue;
      }

      // Idempotency — skip duplicate webhook deliveries using Redis SET NX
      if (redis) {
        const key = `wa:msg:${msg.messageId}`;
        const first = await redis.set(key, "1", { nx: true, ex: 86400 }); // 24h TTL
        if (first === null) {
          log.warn("[webhook] duplicate message skipped", { messageId: msg.messageId });
          continue;
        }
      }

      const response = await runAgent({
        clubId: club.id,
        waContactId: msg.from,
        waGroupId: msg.groupId,
        incomingText: msg.text,
        playerName: msg.senderName,
      });

      await sendWhatsAppMessage(msg.from, response);
      log.info("[webhook] message handled", {
        messageId: msg.messageId,
        from: msg.from,
        clubId: club.id,
      });
    } catch (err) {
      log.error("[webhook] Error handling message", { from: msg.from, error: String(err) });
      try {
        await sendWhatsAppMessage(
          msg.from,
          "Sorry, something went wrong. Please try again or contact the club directly."
        );
      } catch (sendErr) {
        log.error("[webhook] Failed to send fallback message", {
          from: msg.from,
          error: String(sendErr),
        });
      }
    }
  }
}

async function resolveClub(
  senderPhone: string,
  groupId?: string,
  receivingNumberId?: string
): Promise<Club | null> {
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

  // DM with a known receiving number → route to the matching club
  if (receivingNumberId) {
    const { data: club } = await db
      .from("clubs")
      .select("*")
      .eq("whatsapp_number", receivingNumberId)
      .eq("is_active", true)
      .maybeSingle();

    if (club) return club;
  }

  // Fallback: first active club (single-club / misconfigured multi-club setup)
  const { data: club } = await db
    .from("clubs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return club ?? null;
}
