import type { Tool } from "@/lib/llm/types";
import type { BookingProvider } from "@/lib/booking/interface";
import { db } from "@/lib/db";

export const BOOKING_TOOLS: Tool[] = [
  {
    name: "check_availability",
    description:
      "Check available padel court slots for a given date. Returns a list of open time slots with court names and times.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format (e.g. 2025-06-15)",
        },
        time_from: {
          type: "string",
          description: "Optional earliest start time in HH:MM format (e.g. 08:00)",
        },
        time_to: {
          type: "string",
          description: "Optional latest start time in HH:MM format (e.g. 22:00)",
        },
        court_id: {
          type: "string",
          description: "Optional specific court ID to check",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "create_booking",
    description:
      "Book a specific court slot for the player. Requires the slot ID from check_availability, and the player's name.",
    inputSchema: {
      type: "object",
      properties: {
        slot_id: {
          type: "string",
          description: "The slot ID returned by check_availability",
        },
        player_name: {
          type: "string",
          description: "The player's full name",
        },
      },
      required: ["slot_id", "player_name"],
    },
  },
  {
    name: "cancel_booking",
    description: "Cancel an existing booking by its reference number.",
    inputSchema: {
      type: "object",
      properties: {
        booking_reference: {
          type: "string",
          description: "The booking reference or ID to cancel",
        },
      },
      required: ["booking_reference"],
    },
  },
  {
    name: "get_player_bookings",
    description: "Get all upcoming bookings for the current player.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export interface ToolContext {
  bookingProvider: BookingProvider;
  playerPhone: string;
  clubId: string;
  conversationId: string;
  playerName?: string;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  try {
    switch (toolName) {
      case "check_availability": {
        const slots = await ctx.bookingProvider.getAvailability({
          date: input.date as string,
          courtId: input.court_id as string | undefined,
          timeFrom: input.time_from as string | undefined,
          timeTo: input.time_to as string | undefined,
        });

        if (slots.length === 0) {
          return JSON.stringify({ available: false, message: "No slots available for this date." });
        }

        return JSON.stringify({
          available: true,
          slots: slots.map((s) => ({
            id: s.id,
            court: s.courtName,
            date: s.date,
            start: s.startTime,
            end: s.endTime,
            duration: s.durationMinutes,
            price: s.price ? `${s.price} ${s.currency}` : undefined,
          })),
        });
      }

      case "create_booking": {
        const booking = await ctx.bookingProvider.createBooking({
          slotId: input.slot_id as string,
          playerName: input.player_name as string,
          playerPhone: ctx.playerPhone,
        });

        await db.from("booking_activity").insert({
          club_id: ctx.clubId,
          conversation_id: ctx.conversationId,
          wa_contact_id: ctx.playerPhone,
          player_name: input.player_name as string,
          action: "BOOKED",
          booking_ref: booking.reference,
          court_name: booking.courtName,
          slot_date: booking.date,
          slot_time: booking.startTime,
        });

        return JSON.stringify({
          success: true,
          booking: {
            reference: booking.reference,
            court: booking.courtName,
            date: booking.date,
            time: `${booking.startTime} – ${booking.endTime}`,
          },
        });
      }

      case "cancel_booking": {
        await ctx.bookingProvider.cancelBooking({
          bookingId: input.booking_reference as string,
        });

        await db.from("booking_activity").insert({
          club_id: ctx.clubId,
          conversation_id: ctx.conversationId,
          wa_contact_id: ctx.playerPhone,
          player_name: ctx.playerName ?? null,
          action: "CANCELLED",
          booking_ref: input.booking_reference as string,
        });

        return JSON.stringify({ success: true });
      }

      case "get_player_bookings": {
        const bookings = await ctx.bookingProvider.getBookingsByPlayer({
          playerPhone: ctx.playerPhone,
        });

        await db.from("booking_activity").insert({
          club_id: ctx.clubId,
          conversation_id: ctx.conversationId,
          wa_contact_id: ctx.playerPhone,
          player_name: ctx.playerName ?? null,
          action: "CHECKED",
        });

        return JSON.stringify({
          bookings: bookings.map((b) => ({
            reference: b.reference,
            court: b.courtName,
            date: b.date,
            time: `${b.startTime} – ${b.endTime}`,
            status: b.status,
          })),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: message });
  }
}
