// Row types derived from Supabase-generated Database type.
// These are re-exported for convenience — always prefer these over the raw Database type.
import type { Tables, Enums } from "./database.types";

export type Club = Tables<"clubs">;
export type WhatsAppGroup = Tables<"whatsapp_groups">;
export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;
export type BookingActivity = Tables<"booking_activity">;

// Enum types
export type BookingPlatform = Enums<"booking_platform">;
export type MessageRole = Enums<"message_role">;

// Runtime constants for enum values (use these instead of raw strings)
export const BookingPlatform = {
  COURTRESERVE: "COURTRESERVE",
  PLAYTOMIC: "PLAYTOMIC",
  CUSTOM: "CUSTOM",
} as const satisfies Record<string, BookingPlatform>;

export const Role = {
  USER: "USER",
  ASSISTANT: "ASSISTANT",
  TOOL: "TOOL",
} as const satisfies Record<string, MessageRole>;
