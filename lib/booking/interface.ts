export interface Slot {
  id: string;
  courtId: string;
  courtName: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM (24h)
  endTime: string;    // HH:MM (24h)
  durationMinutes: number;
  price?: number;
  currency?: string;
  available: boolean;
}

export interface Booking {
  id: string;
  slotId?: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  playerName: string;
  playerPhone: string;
  reference: string;
  status: "confirmed" | "cancelled" | "pending";
}

export interface BookingProvider {
  getAvailability(params: {
    date: string;
    courtId?: string;
    timeFrom?: string;
    timeTo?: string;
  }): Promise<Slot[]>;

  createBooking(params: {
    slotId: string;
    playerName: string;
    playerPhone: string;
  }): Promise<Booking>;

  cancelBooking(params: {
    bookingId: string;
  }): Promise<void>;

  getBookingsByPlayer(params: {
    playerPhone: string;
  }): Promise<Booking[]>;
}
