-- Task 19: Tool result persistence for accurate multi-turn memory
-- Stores the full Anthropic tool_use content array on assistant messages that triggered tool calls.
-- Enables correct reconstruction of tool_use + tool_result pairs on history reload.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_use_block JSONB;
