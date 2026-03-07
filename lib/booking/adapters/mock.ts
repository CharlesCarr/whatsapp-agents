import type { BookingProvider, Slot, Booking } from "../interface";

// In-memory store so bookings persist within a single server session
const bookings: Map<string, Booking> = new Map();

function generateRef(): string {
  return "MOCK-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function toTimeStr(hour: number, minuteSuffix: string): string {
  return `${String(hour).padStart(2, "0")}:${minuteSuffix}`;
}

// Generates 90-min slots from 08:00–22:00 for the requested date
function generateSlots(date: string, timeFrom?: string, timeTo?: string): Slot[] {
  const courts = [
    { id: "court-1", name: "Court 1" },
    { id: "court-2", name: "Court 2" },
  ];

  const startHour = timeFrom ? parseInt(timeFrom.split(":")[0]!) : 8;
  const endHour = timeTo ? parseInt(timeTo.split(":")[0]!) : 21;

  const slots: Slot[] = [];

  for (const court of courts) {
    for (let h = startHour; h <= endHour; h++) {
      const slotId = `${court.id}-${date}-${h}`;
      const alreadyBooked = [...bookings.values()].some((b) => b.slotId === slotId);

      slots.push({
        id: slotId,
        courtId: court.id,
        courtName: court.name,
        date,
        startTime: toTimeStr(h, "00"),
        endTime: toTimeStr(h + 1, "30"),
        durationMinutes: 90,
        price: 20,
        currency: "EUR",
        available: !alreadyBooked,
      });
    }
  }

  return slots.filter((s) => s.available);
}

export class MockAdapter implements BookingProvider {
  async getAvailability(params: {
    date: string;
    courtId?: string;
    timeFrom?: string;
    timeTo?: string;
  }): Promise<Slot[]> {
    let slots = generateSlots(params.date, params.timeFrom, params.timeTo);
    if (params.courtId) {
      slots = slots.filter((s) => s.courtId === params.courtId);
    }
    return slots;
  }

  async createBooking(params: {
    slotId: string;
    playerName: string;
    playerPhone: string;
  }): Promise<Booking> {
    // Parse date and times back from the slot ID (e.g. "court-1-2026-03-06-10")
    const parts = params.slotId.split("-");
    const hour = parseInt(parts[parts.length - 1]!);
    const bookingDate = parts.slice(2, 5).join("-"); // YYYY-MM-DD
    const courtId = parts.slice(0, 2).join("-");     // "court-1" or "court-2"
    const courtName = courtId === "court-1" ? "Court 1" : "Court 2";

    const booking: Booking = {
      id: generateRef(),
      slotId: params.slotId,
      courtId,
      courtName,
      date: bookingDate,
      startTime: toTimeStr(hour, "00"),
      endTime: toTimeStr(hour + 1, "30"),
      playerName: params.playerName,
      playerPhone: params.playerPhone,
      reference: generateRef(),
      status: "confirmed",
    };

    bookings.set(booking.id, booking);
    return booking;
  }

  async cancelBooking(params: { bookingId: string }): Promise<void> {
    const booking = bookings.get(params.bookingId);
    if (!booking) throw new Error(`Booking not found: ${params.bookingId}`);
    booking.status = "cancelled";
  }

  async getBookingsByPlayer(params: { playerPhone: string }): Promise<Booking[]> {
    return [...bookings.values()].filter(
      (b) => b.playerPhone === params.playerPhone && b.status !== "cancelled"
    );
  }
}
