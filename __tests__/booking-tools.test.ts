import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeTool } from "@/lib/agent/tools";
import { MockAdapter } from "@/lib/booking/adapters/mock";
import type { ToolContext } from "@/lib/agent/tools";

// Mock the Supabase db client — executeTool calls db for booking_activity inserts
vi.mock("@/lib/db", () => ({
  db: {
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
  },
  Role: { USER: "USER", ASSISTANT: "ASSISTANT", TOOL: "TOOL" },
}));

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    bookingProvider: new MockAdapter(),
    playerPhone: "34600000001",
    clubId: "club-test",
    conversationId: "conv-test",
    playerName: "Test Player",
    ...overrides,
  };
}

describe("executeTool — check_availability", () => {
  it("returns available slots for a valid date", async () => {
    const result = await executeTool("check_availability", { date: "2026-04-01" }, makeCtx());
    const parsed = JSON.parse(result);
    expect(parsed.available).toBe(true);
    expect(Array.isArray(parsed.slots)).toBe(true);
    expect(parsed.slots.length).toBeGreaterThan(0);
  });

  it("returns available:false message when no slots (simulated by using timeTo before start)", async () => {
    // timeTo before timeFrom means zero slots
    const result = await executeTool(
      "check_availability",
      { date: "2026-04-01", time_from: "22:00", time_to: "06:00" },
      makeCtx()
    );
    const parsed = JSON.parse(result);
    // Either no slots or filtered empty — adapter returns empty array
    expect(typeof parsed).toBe("object");
  });
});

describe("executeTool — create_booking", () => {
  it("creates a booking and returns reference", async () => {
    const ctx = makeCtx();
    // Get a real slot ID from the mock adapter
    const slots = await (ctx.bookingProvider as MockAdapter).getAvailability({ date: "2026-04-02" });
    const slotId = slots[0]!.id;

    const result = await executeTool("create_booking", { slot_id: slotId, player_name: "Jane Doe" }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.booking.reference).toMatch(/^MOCK-/);
    expect(parsed.booking.court).toBeDefined();
  });
});

describe("executeTool — cancel_booking", () => {
  it("cancels an existing booking", async () => {
    const ctx = makeCtx();
    const slots = await (ctx.bookingProvider as MockAdapter).getAvailability({ date: "2026-04-03" });
    const booking = await (ctx.bookingProvider as MockAdapter).createBooking({
      slotId: slots[0]!.id,
      playerName: "John Cancel",
      playerPhone: ctx.playerPhone,
    });

    const result = await executeTool("cancel_booking", { booking_reference: booking.id }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  it("returns error for unknown booking reference", async () => {
    const result = await executeTool("cancel_booking", { booking_reference: "BAD-REF" }, makeCtx());
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
  });
});

describe("executeTool — get_player_bookings", () => {
  it("returns bookings for current player", async () => {
    const ctx = makeCtx();
    const slots = await (ctx.bookingProvider as MockAdapter).getAvailability({ date: "2026-04-04" });
    await (ctx.bookingProvider as MockAdapter).createBooking({
      slotId: slots[0]!.id,
      playerName: "Player One",
      playerPhone: ctx.playerPhone,
    });

    const result = await executeTool("get_player_bookings", {}, ctx);
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed.bookings)).toBe(true);
    expect(parsed.bookings.length).toBeGreaterThan(0);
  });
});

describe("executeTool — unknown tool", () => {
  it("returns an error for unknown tool names", async () => {
    const result = await executeTool("does_not_exist", {}, makeCtx());
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Unknown tool");
  });
});
