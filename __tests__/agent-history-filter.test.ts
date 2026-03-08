/**
 * Tests for the LLM message history reconstruction logic used in lib/agent/conversation.ts.
 *
 * History is reconstructed (not filtered) so that tool_use + tool_result pairs are correctly
 * paired for the Anthropic API. Assistant messages with tool_use_block get their toolCalls
 * restored; orphaned TOOL messages (old data without tool_use_block on the preceding
 * ASSISTANT) are dropped to prevent Anthropic API validation errors.
 */

import { describe, it, expect } from "vitest";

type FakeMessage = {
  role: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  tool_use_block?: unknown[] | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
};

type ReconstructedMessage = {
  role: string;
  content: string;
  toolCalls?: unknown[];
  toolCallId?: string;
  toolName?: string;
};

// Mirror the reconstruction logic from conversation.ts
function reconstructLlmMessages(messages: FakeMessage[]): ReconstructedMessage[] {
  const result: ReconstructedMessage[] = [];

  for (const m of messages) {
    if (m.role === "ASSISTANT" && m.tool_use_block) {
      result.push({ role: "assistant", content: m.content, toolCalls: m.tool_use_block });
    } else if (m.role === "TOOL") {
      const prev = result[result.length - 1];
      if (prev?.role === "assistant" && prev.toolCalls?.length) {
        result.push({
          role: "tool",
          content: m.content,
          toolCallId: m.tool_call_id ?? "",
          toolName: m.tool_name ?? "",
        });
      }
      // else: orphaned tool result — skip to avoid Anthropic API validation error
    } else if (m.role === "USER" || m.role === "ASSISTANT") {
      result.push({ role: m.role === "USER" ? "user" : "assistant", content: m.content });
    }
  }

  return result;
}

describe("reconstructLlmMessages", () => {
  it("keeps USER messages", () => {
    const msgs: FakeMessage[] = [{ role: "USER", content: "Book court 1 at 10am" }];
    expect(reconstructLlmMessages(msgs)).toHaveLength(1);
    expect(reconstructLlmMessages(msgs)[0]!.role).toBe("user");
  });

  it("keeps final ASSISTANT messages without tool_use_block", () => {
    const msgs: FakeMessage[] = [
      { role: "ASSISTANT", content: "Your court is booked. Ref: ABC123." },
    ];
    const result = reconstructLlmMessages(msgs);
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("assistant");
  });

  it("reconstructs assistant+tool pairs when tool_use_block is present", () => {
    const toolCall = { name: "check_availability", id: "tc1", input: {} };
    const msgs: FakeMessage[] = [
      { role: "USER", content: "Book court 1" },
      {
        role: "ASSISTANT",
        content: "[Tools: check_availability]",
        tool_use_block: [toolCall],
      },
      {
        role: "TOOL",
        content: '{"slots":[{"id":"court-1-2026-03-08-10"}]}',
        tool_call_id: "tc1",
        tool_name: "check_availability",
      },
      { role: "ASSISTANT", content: "Court 1 is available at 10am. Shall I confirm?" },
    ];

    const result = reconstructLlmMessages(msgs);
    expect(result).toHaveLength(4);
    expect(result[0]!.role).toBe("user");
    expect(result[1]!.role).toBe("assistant");
    expect(result[1]!.toolCalls).toEqual([toolCall]);
    expect(result[2]!.role).toBe("tool");
    expect(result[2]!.toolCallId).toBe("tc1");
    expect(result[3]!.content).toContain("Court 1 is available");
  });

  it("drops orphaned TOOL messages (old data without tool_use_block)", () => {
    // Pre-Task-19 data: TOOL message with no matching tool_use_block on preceding ASSISTANT
    const msgs: FakeMessage[] = [
      { role: "USER", content: "Check availability" },
      {
        role: "ASSISTANT",
        content: "[Tools: check_availability]",
        metadata: { toolCalls: [{ name: "check_availability", id: "tc1", input: {} }] },
        tool_use_block: null, // old data — no tool_use_block stored
      },
      {
        role: "TOOL",
        content: '{"available":true,"slots":[]}',
        tool_call_id: "tc1",
        tool_name: "check_availability",
      },
      { role: "ASSISTANT", content: "No slots available today." },
    ];

    const result = reconstructLlmMessages(msgs);
    // Orphaned TOOL is dropped; old ASSISTANT without tool_use_block is treated as plain text
    expect(result.every((m) => m.role !== "tool")).toBe(true);
    expect(result).toHaveLength(3); // user + assistant (no block) + final assistant
  });

  it("handles messages with null metadata (no toolCalls field)", () => {
    const msgs: FakeMessage[] = [
      { role: "ASSISTANT", content: "Hello! How can I help?", metadata: null },
    ];
    expect(reconstructLlmMessages(msgs)).toHaveLength(1);
  });

  it("handles an empty message list", () => {
    expect(reconstructLlmMessages([])).toHaveLength(0);
  });
});
