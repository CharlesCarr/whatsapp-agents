import type { IncomingMessage, WhatsAppWebhookPayload, WebhookMessage, WebhookContact } from "./types";

const WA_API_URL = process.env.WHATSAPP_API_URL || "https://waba.360dialog.io/v1";
const WA_API_KEY = process.env.WHATSAPP_API_KEY || "";
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

// 360dialog uses a different base URL and auth header than Meta Cloud API
// When migrating to Meta Cloud API, update WA_API_URL and swap D360-WABA-Key for Bearer token
export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };

  const url = WA_API_URL.includes("360dialog")
    ? `${WA_API_URL}/messages`
    : `https://graph.facebook.com/v18.0/${WA_PHONE_NUMBER_ID}/messages`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (WA_API_URL.includes("360dialog")) {
    headers["D360-WABA-Key"] = WA_API_KEY;
  } else {
    headers["Authorization"] = `Bearer ${WA_API_KEY}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${err}`);
  }
}

export function parseWebhook(payload: WhatsAppWebhookPayload): IncomingMessage[] {
  const messages: IncomingMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value.messages?.length) continue;

      const contactMap = new Map<string, WebhookContact>(
        (value.contacts ?? []).map((c: WebhookContact) => [c.wa_id, c])
      );

      for (const msg of value.messages as WebhookMessage[]) {
        const contact = contactMap.get(msg.from);
        const groupId = msg.group_id ?? msg.context?.group_id;

        if (msg.type !== "text" || !msg.text?.body) {
          // Push a synthetic message so the webhook handler can reply gracefully
          messages.push({
            messageId: msg.id,
            from: msg.from,
            groupId,
            text: "__NON_TEXT__",
            type: msg.type,
            timestamp: parseInt(msg.timestamp, 10),
            senderName: contact?.profile?.name,
          });
          continue;
        }

        messages.push({
          messageId: msg.id,
          from: msg.from,
          groupId,
          text: msg.text.body,
          type: msg.type,
          timestamp: parseInt(msg.timestamp, 10),
          senderName: contact?.profile?.name,
        });
      }
    }
  }

  return messages;
}

export function verifyWebhookChallenge(params: {
  mode: string;
  token: string;
  challenge: string;
}): string | null {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (params.mode === "subscribe" && params.token === verifyToken) {
    return params.challenge;
  }
  return null;
}
