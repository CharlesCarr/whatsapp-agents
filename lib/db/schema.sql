-- WhatsApp Padel Agents — Supabase Schema
-- Run this in the Supabase SQL Editor (Database > SQL Editor > New query)

-- Enums
CREATE TYPE booking_platform AS ENUM ('COURTRESERVE', 'PLAYTOMIC', 'CUSTOM');
CREATE TYPE message_role AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- Clubs
CREATE TABLE clubs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  whatsapp_number TEXT NOT NULL UNIQUE,
  booking_platform booking_platform NOT NULL,
  booking_config  JSONB NOT NULL DEFAULT '{}',
  agent_config    JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WhatsApp groups linked to clubs
CREATE TABLE whatsapp_groups (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id  TEXT NOT NULL UNIQUE,
  club_id   TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE
);

-- Conversations (one per player per club, optionally per group)
CREATE TABLE conversations (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id       TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  wa_contact_id TEXT NOT NULL,
  wa_group_id   TEXT,
  player_name   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULLS NOT DISTINCT means two rows with the same club+contact+NULL group are considered duplicates
  UNIQUE NULLS NOT DISTINCT (club_id, wa_contact_id, wa_group_id)
);

-- Messages in each conversation
CREATE TABLE messages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            message_role NOT NULL,
  content         TEXT NOT NULL,
  tool_name       TEXT,
  tool_call_id    TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Booking actions taken by the agent (for the operator activity feed)
CREATE TABLE booking_activity (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id         TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  wa_contact_id   TEXT NOT NULL,
  player_name     TEXT,
  action          TEXT NOT NULL,  -- 'BOOKED' | 'CANCELLED' | 'CHECKED'
  booking_ref     TEXT,
  court_name      TEXT,
  slot_date       TEXT,
  slot_time       TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_conversations_club_id ON conversations(club_id);
CREATE INDEX idx_conversations_wa_contact_id ON conversations(wa_contact_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_booking_activity_club_id ON booking_activity(club_id);
CREATE INDEX idx_booking_activity_created_at ON booking_activity(created_at DESC);

-- Auto-update updated_at on clubs and conversations
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
