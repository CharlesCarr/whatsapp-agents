import { describe, it, expect, beforeEach } from "vitest";
import { MockAdapter } from "@/lib/booking/adapters/mock";

describe("MockAdapter", () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    // Each test gets a fresh adapter instance to avoid shared booking state
    adapter = new MockAdapter();
  });

  it("returns available slots for a date", async () => {
    const slots = await adapter.getAvailability({ date: "2026-03-10" });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toMatchObject({
      date: "2026-03-10",
      available: true,
      durationMinutes: 90,
    });
  });

  it("filters slots by courtId", async () => {
    const slots = await adapter.getAvailability({ date: "2026-03-10", courtId: "court-1" });
    expect(slots.every((s) => s.courtId === "court-1")).toBe(true);
  });

  it("filters slots by timeFrom", async () => {
    const slots = await adapter.getAvailability({ date: "2026-03-10", timeFrom: "14:00" });
    const startHours = slots.map((s) => parseInt(s.startTime.split(":")[0]!));
    expect(startHours.every((h) => h >= 14)).toBe(true);
  });

  it("creates a booking and returns a reference", async () => {
    const slots = await adapter.getAvailability({ date: "2026-03-11" });
    const slot = slots[0]!;

    const booking = await adapter.createBooking({
      slotId: slot.id,
      playerName: "Alice Smith",
      playerPhone: "34600000001",
    });

    expect(booking.reference).toMatch(/^MOCK-/);
    expect(booking.status).toBe("confirmed");
    expect(booking.playerName).toBe("Alice Smith");
    expect(booking.courtName).toBeDefined();
  });

  it("booked slot no longer appears in availability", async () => {
    const slots = await adapter.getAvailability({ date: "2026-03-12" });
    const slot = slots[0]!;

    await adapter.createBooking({
      slotId: slot.id,
      playerName: "Bob Jones",
      playerPhone: "34600000002",
    });

    const slotsAfter = await adapter.getAvailability({ date: "2026-03-12" });
    const stillAvailable = slotsAfter.find((s) => s.id === slot.id);
    expect(stillAvailable).toBeUndefined();
  });

  it("getBookingsByPlayer returns player bookings", async () => {
    const slots = await adapter.getAvailability({ date: "2026-03-13" });
    const slot = slots[0]!;

    await adapter.createBooking({
      slotId: slot.id,
      playerName: "Carol White",
      playerPhone: "34600000003",
    });

    const playerBookings = await adapter.getBookingsByPlayer({ playerPhone: "34600000003" });
    expect(playerBookings).toHaveLength(1);
    expect(playerBookings[0]!.playerName).toBe("Carol White");
  });

  it("cancelBooking marks booking as cancelled", async () => {
    const slots = await adapter.getAvailability({ date: "2026-03-14" });
    const booking = await adapter.createBooking({
      slotId: slots[0]!.id,
      playerName: "Dave Brown",
      playerPhone: "34600000004",
    });

    await adapter.cancelBooking({ bookingId: booking.id });

    const playerBookings = await adapter.getBookingsByPlayer({ playerPhone: "34600000004" });
    expect(playerBookings).toHaveLength(0); // cancelled bookings are excluded
  });

  it("cancelBooking throws for unknown booking", async () => {
    await expect(adapter.cancelBooking({ bookingId: "nonexistent" })).rejects.toThrow(
      "Booking not found: nonexistent"
    );
  });
});
