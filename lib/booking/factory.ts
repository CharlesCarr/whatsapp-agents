import { BookingPlatform } from "@/lib/db/types";
import type { BookingProvider } from "./interface";
import { CourtReserveAdapter, type CourtReserveConfig } from "./adapters/courtreserve";
import { PlaytomicAdapter, type PlaytomicConfig } from "./adapters/playtomic";
import { CustomAdapter, type CustomAdapterConfig } from "./adapters/custom";
import { MockAdapter } from "./adapters/mock";

export function createBookingProvider(
  platform: BookingPlatform,
  config: Record<string, unknown>
): BookingProvider {
  switch (platform) {
    case BookingPlatform.COURTRESERVE:
      return new CourtReserveAdapter(config as unknown as CourtReserveConfig);
    case BookingPlatform.PLAYTOMIC:
      return new PlaytomicAdapter(config as unknown as PlaytomicConfig);
    case BookingPlatform.CUSTOM:
      // Set booking_config to { "mock": true } to use the in-memory mock adapter
      if (config.mock === true) return new MockAdapter();
      return new CustomAdapter(config as unknown as CustomAdapterConfig);
    default:
      throw new Error(`Unknown booking platform: ${platform}`);
  }
}

export * from "./interface";
