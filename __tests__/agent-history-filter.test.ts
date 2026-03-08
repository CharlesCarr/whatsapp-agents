/**
 * Tests for the LLM message history filter logic used in lib/agent/conversation.ts.
 *
 * The filter excludes:
 * - Messages with role === "TOOL"
 * - Assistant messages that have metadata.toolCalls (intermediate tool-calling turns)
 * Final assistant replies (no toolCalls metadata) are kept.
 */

import { describe, it, expect } from "vitest";

// Mirror the filter predicate from conversation.ts so we can unit-test it independently
type FakeMessage = {
  role: string;
  content: string;
  metadata?: Record<string, unknown> | null;
};

function filterLlmMessages(messages: FakeMessage[]): FakeMessage[] {
  return messages.filter((m) => {
    if (m.role === "TOOL") return false;
    if (m.role === "ASSISTANT" && m.metadata && m.metadata.toolCalls) return false;
    return true;
  });
}

describe("llmMessages filter", () => {
  it("keeps USER messages", () => {
    const msgs: FakeMessage[] = [
      { role: "USER", content: "Book court 1 at 10am" },
    ];
    expect(filterLlmMessages(msgs)).toHaveLength(1);
  });

  it("keeps final ASSISTANT messages without toolCalls metadata", () => {
    const msgs: FakeMessage[] = [
      { role: "ASSISTANT", content: "Your court is booked. Ref: ABC123." },
    ];
    expect(filterLlmMessages(msgs)).toHaveLength(1);
  });

  it("excludes TOOL messages", () => {
    const msgs: FakeMessage[] = [
      { role: "USER", content: "Check availability" },
      { role: "TOOL", content: '{"available":true,"slots":[]}' },
    ];
    const filtered = filterLlmMessages(msgs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.role).toBe("USER");
  });

  it("excludes intermediate ASSISTANT messages that triggered tool calls", () => {
    const msgs: FakeMessage[] = [
      { role: "USER", content: "Book court 1" },
      {
        role: "ASSISTANT",
        content: "[Tools: check_availability]",
        metadata: { toolCalls: [{ name: "check_availability", id: "tc1", input: {} }] },
      },
      { role: "TOOL", content: '{"slots":[{"id":"court-1-2026-03-08-10"}]}' },
      { role: "ASSISTANT", content: "Court 1 is available at 10am. Shall I confirm?" },
    ];

    const filtered = filterLlmMessages(msgs);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.role).toBe("USER");
    expect(filtered[1]!.content).toContain("Court 1 is available");
  });

  it("handles messages with null metadata (no toolCalls field)", () => {
    const msgs: FakeMessage[] = [
      { role: "ASSISTANT", content: "Hello! How can I help?", metadata: null },
    ];
    expect(filterLlmMessages(msgs)).toHaveLength(1);
  });

  it("handles an empty message list", () => {
    expect(filterLlmMessages([])).toHaveLength(0);
  });
});
