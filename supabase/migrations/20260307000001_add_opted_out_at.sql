-- Task 17: WhatsApp opt-out handling
-- Tracks when a player opted out of messages (STOP / UNSUBSCRIBE keyword).
-- Per Meta platform policy, opted-out contacts must not receive agent replies.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;
