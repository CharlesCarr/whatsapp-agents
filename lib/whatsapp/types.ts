// Normalized incoming message from WhatsApp webhook
export interface IncomingMessage {
  messageId: string;
  from: string;        // sender's WhatsApp number (e.g. "15551234567")
  groupId?: string;    // group JID if from a group chat
  text: string;
  timestamp: number;
  senderName?: string;
}

// 360dialog / Meta Cloud API webhook payload shapes
export interface WhatsAppWebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
}

export interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface WebhookMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  context?: { from: string; id: string; group_id?: string };
  group_id?: string;
}

export interface WebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}
