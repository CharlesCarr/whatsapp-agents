import { describe, it, expect } from "vitest";
import { parseWebhook } from "@/lib/whatsapp/client";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";

function makePayload(messages: object[], metadata = { display_phone_number: "34600000001", phone_number_id: "pid-123" }): WhatsAppWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata,
              contacts: [{ profile: { name: "Test Player" }, wa_id: "34600000000" }],
              // Cast via unknown — tests supply partial objects; the parser handles missing fields gracefully
              messages: messages as unknown as WhatsAppWebhookPayload["entry"][number]["changes"][number]["value"]["messages"],
            },
          },
        ],
      },
    ],
  };
}

describe("parseWebhook", () => {
  it("parses a plain text message", () => {
    const payload = makePayload([
      {
        id: "msg-1",
        from: "34600000000",
        timestamp: "1700000000",
        type: "text",
        text: { body: "Book court 1 tomorrow" },
      },
    ]);

    const msgs = parseWebhook(payload);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.text).toBe("Book court 1 tomorrow");
    expect(msgs[0]!.type).toBe("text");
    expect(msgs[0]!.from).toBe("34600000000");
    expect(msgs[0]!.senderName).toBe("Test Player");
    expect(msgs[0]!.receivingNumberId).toBe("pid-123");
  });

  it("returns synthetic __NON_TEXT__ message for non-text types", () => {
    const payload = makePayload([
      {
        id: "msg-2",
        from: "34600000000",
        timestamp: "1700000001",
        type: "audio",
      },
    ]);

    const msgs = parseWebhook(payload);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.text).toBe("__NON_TEXT__");
    expect(msgs[0]!.type).toBe("audio");
  });

  it("returns synthetic __NON_TEXT__ message for image messages", () => {
    const payload = makePayload([
      {
        id: "msg-3",
        from: "34600000000",
        timestamp: "1700000002",
        type: "image",
        image: { id: "img-id", mime_type: "image/jpeg" },
      },
    ]);

    const msgs = parseWebhook(payload);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.text).toBe("__NON_TEXT__");
  });

  it("attaches groupId from group message context", () => {
    const payload = makePayload([
      {
        id: "msg-4",
        from: "34600000000",
        timestamp: "1700000003",
        type: "text",
        text: { body: "Any slots free?" },
        group_id: "group-abc",
      },
    ]);

    const msgs = parseWebhook(payload);
    expect(msgs[0]!.groupId).toBe("group-abc");
  });

  it("returns empty array when there are no messages", () => {
    const payload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "34600000001", phone_number_id: "pid-1" },
                statuses: [{ id: "s1", status: "delivered", timestamp: "1700000004", recipient_id: "34600000000" }],
              },
            },
          ],
        },
      ],
    };

    const msgs = parseWebhook(payload);
    expect(msgs).toHaveLength(0);
  });
});
