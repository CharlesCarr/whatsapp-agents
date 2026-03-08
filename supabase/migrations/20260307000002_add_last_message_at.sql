-- Task 18: Conversation session TTL
-- Tracks when the last message was processed in a conversation.
-- Sessions idle for more than 7 days are treated as expired (history cleared on next contact).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
