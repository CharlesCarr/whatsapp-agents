/**
 * Seed script for local development.
 * Creates a demo padel club with mock booking config.
 *
 * Usage: npm run seed
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey);

async function seed() {
  console.log("Seeding local database…");

  const clubData = {
    name: "Demo Padel Club",
    booking_platform: "CUSTOM" as const,
    booking_config: { mock: true },
    agent_config: {
      courtNames: ["Court 1", "Court 2", "Court 3", "Court 4"],
      operatingHours: "8:00 AM – 10:00 PM",
      clubTone: "friendly and concise",
    },
    is_active: true,
    whatsapp_number: "demo-number-id",
  };

  // Check if demo club already exists
  const { data: existing } = await db
    .from("clubs")
    .select("id, name")
    .eq("name", clubData.name)
    .maybeSingle();

  if (existing) {
    console.log(`Demo club already exists (id: ${existing.id}) — skipping insert.`);
    return;
  }

  const { data: club, error } = await db
    .from("clubs")
    .insert(clubData)
    .select()
    .single();

  if (error) {
    console.error("Failed to create demo club:", error.message);
    process.exit(1);
  }

  console.log(`Created demo club: "${club.name}" (id: ${club.id})`);
  console.log("\nSeed complete. Start the dev server with: npm run dev");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
