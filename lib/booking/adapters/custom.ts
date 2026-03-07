import type { BookingProvider, Slot, Booking } from "../interface";

export interface CustomAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  // Field mapping — allows adapter to map custom API fields to our schema
  fieldMapping?: {
    slotId?: string;
    courtId?: string;
    courtName?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    available?: string;
    bookingId?: string;
    reference?: string;
    status?: string;
  };
}

// Generic configurable REST adapter for custom booking backends
export class CustomAdapter implements BookingProvider {
  private config: CustomAdapterConfig;

  constructor(config: CustomAdapterConfig) {
    this.config = config;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.config.headers ?? {}),
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers ?? {}) },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Custom adapter API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  private map<T extends Record<string, unknown>>(raw: T, key: string, fallback: string): string {
    const mappedKey = (this.config.fieldMapping as Record<string, string> | undefined)?.[key] ?? fallback;
    return String(raw[mappedKey] ?? "");
  }

  async getAvailability(params: {
    date: string;
    courtId?: string;
    timeFrom?: string;
    timeTo?: string;
  }): Promise<Slot[]> {
    const query = new URLSearchParams({
      date: params.date,
      ...(params.courtId ? { courtId: params.courtId } : {}),
      ...(params.timeFrom ? { timeFrom: params.timeFrom } : {}),
      ...(params.timeTo ? { timeTo: params.timeTo } : {}),
    });

    const data = await this.request<Record<string, unknown>[]>(
      `/availability?${query.toString()}`
    );

    return data.map((raw) => ({
      id: this.map(raw, "slotId", "id"),
      courtId: this.map(raw, "courtId", "courtId"),
      courtName: this.map(raw, "courtName", "courtName"),
      date: this.map(raw, "date", "date"),
      startTime: this.map(raw, "startTime", "startTime"),
      endTime: this.map(raw, "endTime", "endTime"),
      durationMinutes: Number(raw.durationMinutes ?? 60),
      available: Boolean(raw[this.config.fieldMapping?.available ?? "available"] ?? true),
    }));
  }

  async createBooking(params: {
    slotId: string;
    playerName: string;
    playerPhone: string;
  }): Promise<Booking> {
    const data = await this.request<Record<string, unknown>>("/bookings", {
      method: "POST",
      body: JSON.stringify({
        slotId: params.slotId,
        playerName: params.playerName,
        playerPhone: params.playerPhone,
      }),
    });

    return {
      id: this.map(data, "bookingId", "id"),
      courtId: this.map(data, "courtId", "courtId"),
      courtName: this.map(data, "courtName", "courtName"),
      date: this.map(data, "date", "date"),
      startTime: this.map(data, "startTime", "startTime"),
      endTime: this.map(data, "endTime", "endTime"),
      playerName: params.playerName,
      playerPhone: params.playerPhone,
      reference: this.map(data, "reference", "reference") || this.map(data, "bookingId", "id"),
      status: "confirmed",
    };
  }

  async cancelBooking(params: { bookingId: string }): Promise<void> {
    await this.request(`/bookings/${params.bookingId}/cancel`, { method: "POST" });
  }

  async getBookingsByPlayer(params: { playerPhone: string }): Promise<Booking[]> {
    const data = await this.request<Record<string, unknown>[]>(
      `/bookings?playerPhone=${params.playerPhone}`
    );

    return data.map((raw) => ({
      id: this.map(raw, "bookingId", "id"),
      courtId: this.map(raw, "courtId", "courtId"),
      courtName: this.map(raw, "courtName", "courtName"),
      date: this.map(raw, "date", "date"),
      startTime: this.map(raw, "startTime", "startTime"),
      endTime: this.map(raw, "endTime", "endTime"),
      playerName: String(raw.playerName ?? ""),
      playerPhone: params.playerPhone,
      reference: this.map(raw, "reference", "reference"),
      status: "confirmed",
    }));
  }
}
