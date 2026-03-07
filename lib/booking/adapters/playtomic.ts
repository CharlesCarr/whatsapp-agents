import type { BookingProvider, Slot, Booking } from "../interface";

export interface PlaytomicConfig {
  email: string;
  password: string;
  tenantId: string; // Playtomic club/tenant ID
}

// Playtomic adapter using reverse-engineered mobile API
// WARNING: No official public API exists. This uses the same endpoints as the
// Playtomic mobile app. Treat as provisional — plan for official partnership.
// Endpoint base: https://playtomic.io/api/v1
export class PlaytomicAdapter implements BookingProvider {
  private config: PlaytomicConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private readonly BASE = "https://playtomic.io/api/v1";

  constructor(config: PlaytomicConfig) {
    this.config = config;
  }

  private async ensureAuth(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;

    const res = await fetch(`${this.BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.config.email,
        password: this.config.password,
      }),
    });

    if (!res.ok) throw new Error(`Playtomic auth failed: ${res.status}`);

    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000 - 30_000;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    await this.ensureAuth();
    const res = await fetch(`${this.BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        ...(options?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Playtomic API error ${res.status}: ${text}`);
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
      tenant_id: this.config.tenantId,
      local_start_min: `${params.date}T${params.timeFrom ?? "06:00"}:00`,
      local_start_max: `${params.date}T${params.timeTo ?? "22:00"}:00`,
    });

    const data = await this.request<PlaytomicSlot[]>(
      `/availability?${query.toString()}`
    );

    return data
      .filter((s) => !params.courtId || s.resource_id === params.courtId)
      .map(this.mapSlot);
  }

  async createBooking(params: {
    slotId: string;
    playerName: string;
    playerPhone: string;
  }): Promise<Booking> {
    const [resourceId, startAt] = params.slotId.split("|");
    const data = await this.request<PlaytomicBooking>("/bookings", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: this.config.tenantId,
        resource_id: resourceId,
        start: startAt,
        user: { name: params.playerName, phone: params.playerPhone },
      }),
    });

    return this.mapBooking(data);
  }

  async cancelBooking(params: { bookingId: string }): Promise<void> {
    await this.request(`/bookings/${params.bookingId}`, { method: "DELETE" });
  }

  async getBookingsByPlayer(params: { playerPhone: string }): Promise<Booking[]> {
    const data = await this.request<PlaytomicBooking[]>(
      `/bookings?tenant_id=${this.config.tenantId}&phone=${params.playerPhone}`
    );
    return data.map(this.mapBooking);
  }

  private mapSlot(raw: PlaytomicSlot): Slot {
    const start = new Date(raw.start_time);
    const end = new Date(raw.end_time);
    return {
      id: `${raw.resource_id}|${raw.start_time}`,
      courtId: raw.resource_id,
      courtName: raw.resource_name,
      date: raw.start_time.substring(0, 10),
      startTime: raw.start_time.substring(11, 16),
      endTime: raw.end_time.substring(11, 16),
      durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
      price: raw.price?.amount,
      currency: raw.price?.currency ?? "EUR",
      available: true,
    };
  }

  private mapBooking(raw: PlaytomicBooking): Booking {
    return {
      id: raw.booking_id,
      courtId: raw.resource_id,
      courtName: raw.resource_name ?? "",
      date: raw.start_time.substring(0, 10),
      startTime: raw.start_time.substring(11, 16),
      endTime: raw.end_time?.substring(11, 16) ?? "",
      playerName: raw.user?.name ?? "",
      playerPhone: raw.user?.phone ?? "",
      reference: raw.booking_id,
      status: raw.status === "ACTIVE" ? "confirmed" : "cancelled",
    };
  }
}

interface PlaytomicSlot {
  resource_id: string;
  resource_name: string;
  start_time: string;
  end_time: string;
  price?: { amount: number; currency: string };
}

interface PlaytomicBooking {
  booking_id: string;
  resource_id: string;
  resource_name?: string;
  start_time: string;
  end_time?: string;
  user?: { name: string; phone: string };
  status: string;
}
