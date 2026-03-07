import type { BookingProvider, Slot, Booking } from "../interface";

export interface CourtReserveConfig {
  apiKey: string;
  organizationId: string;
  baseUrl?: string;
}

// CourtReserve REST API adapter
// Docs: https://api.courtreserve.com/api (v1)
export class CourtReserveAdapter implements BookingProvider {
  private config: CourtReserveConfig;
  private baseUrl: string;

  constructor(config: CourtReserveConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? "https://api.courtreserve.com/api";
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(options?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CourtReserve API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getAvailability(params: {
    date: string;
    courtId?: string;
    timeFrom?: string;
    timeTo?: string;
  }): Promise<Slot[]> {
    const query = new URLSearchParams({
      organizationId: this.config.organizationId,
      date: params.date,
      ...(params.courtId ? { courtId: params.courtId } : {}),
      ...(params.timeFrom ? { timeFrom: params.timeFrom } : {}),
      ...(params.timeTo ? { timeTo: params.timeTo } : {}),
    });

    const data = await this.request<CourtReserveSlotResponse[]>(
      `/openings?${query.toString()}`
    );

    return data.map(this.mapSlot);
  }

  async createBooking(params: {
    slotId: string;
    playerName: string;
    playerPhone: string;
  }): Promise<Booking> {
    const data = await this.request<CourtReserveBookingResponse>("/reservations", {
      method: "POST",
      body: JSON.stringify({
        organizationId: this.config.organizationId,
        openingId: params.slotId,
        member: {
          name: params.playerName,
          phoneNumber: params.playerPhone,
        },
      }),
    });

    return this.mapBooking(data);
  }

  async cancelBooking(params: { bookingId: string }): Promise<void> {
    await this.request(`/reservations/${params.bookingId}/cancel`, {
      method: "POST",
    });
  }

  async getBookingsByPlayer(params: { playerPhone: string }): Promise<Booking[]> {
    const query = new URLSearchParams({
      organizationId: this.config.organizationId,
      phoneNumber: params.playerPhone,
    });

    const data = await this.request<CourtReserveBookingResponse[]>(
      `/reservations?${query.toString()}`
    );

    return data.map(this.mapBooking);
  }

  private mapSlot(raw: CourtReserveSlotResponse): Slot {
    return {
      id: raw.id,
      courtId: raw.courtId,
      courtName: raw.courtName,
      date: raw.date,
      startTime: raw.startTime,
      endTime: raw.endTime,
      durationMinutes: raw.durationMinutes,
      price: raw.price,
      currency: raw.currency ?? "USD",
      available: raw.available,
    };
  }

  private mapBooking(raw: CourtReserveBookingResponse): Booking {
    return {
      id: raw.id,
      courtId: raw.courtId,
      courtName: raw.courtName,
      date: raw.date,
      startTime: raw.startTime,
      endTime: raw.endTime,
      playerName: raw.member?.name ?? "",
      playerPhone: raw.member?.phoneNumber ?? "",
      reference: raw.confirmationNumber ?? raw.id,
      status: raw.status === "Active" ? "confirmed" : raw.status === "Cancelled" ? "cancelled" : "pending",
    };
  }
}

// Raw API response shapes (approximate — adjust when API docs confirm)
interface CourtReserveSlotResponse {
  id: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  price?: number;
  currency?: string;
  available: boolean;
}

interface CourtReserveBookingResponse {
  id: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  member?: { name: string; phoneNumber: string };
  confirmationNumber?: string;
  status: string;
}
