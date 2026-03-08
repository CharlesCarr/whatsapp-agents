import { db, Role } from "@/lib/db";
import type { Json } from "@/lib/db/database.types";
import { getDefaultLLMProvider } from "@/lib/llm";
import { createBookingProvider } from "@/lib/booking/factory";
import { BOOKING_TOOLS, executeTool } from "./tools";
import { log } from "@/lib/logger";
import type { Club } from "@/lib/db/types";
import type { Message, ToolCall } from "@/lib/llm/types";

const MAX_HISTORY = 20;
const MAX_TOOL_ITERATIONS = 5;
const SESSION_TTL_DAYS = 7;

interface AgentConfig {
  systemPromptOverride?: string;
  courtNames?: string[];
  operatingHours?: string;
  clubTone?: string;
}

function buildSystemPrompt(club: Club, playerName: string | null): string {
  const config = club.agent_config as AgentConfig;
  const today = new Date().toISOString().split("T")[0]!;
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

  if (config.systemPromptOverride) return config.systemPromptOverride;

  const courts = config.courtNames?.join(", ") ?? "the courts";
  const hours = config.operatingHours ?? "6:00 AM – 10:00 PM";
  const tone = config.clubTone ?? "friendly and concise";

  return `You are the booking assistant for ${club.name}, a padel club. You help players check court availability, make bookings, and cancel reservations via WhatsApp.

Today is ${dayOfWeek}, ${today}.
Courts available: ${courts}
Operating hours: ${hours}
Tone: ${tone}

${playerName ? `You are speaking with ${playerName}.` : "You don't yet know the player's name — if they want to make a booking, ask for their name first."}

Guidelines:
- Always confirm details before booking (court, date, time, player name).
- When showing availability, list the options clearly. Do not show internal slot IDs to the player.
- After booking, always share the confirmation reference.
- Keep responses short and clear — this is WhatsApp, not email.
- If something goes wrong with the booking system, apologize and ask them to try again or contact the club directly.
- Do not make up slot IDs or booking references — only use values returned by the tools.`;
}

export async function runAgent(params: {
  clubId: string;
  waContactId: string;
  waGroupId?: string;
  incomingText: string;
  playerName?: string;
}): Promise<string> {
  const { clubId, waContactId, waGroupId, incomingText, playerName } = params;

  // Load club
  const { data: club, error: clubError } = await db
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .single();

  if (clubError || !club) throw new Error(`Club not found: ${clubId}`);

  // Find or create conversation
  // .is() only accepts null; use .eq() for actual group ID values
  let convQuery = db
    .from("conversations")
    .select("*")
    .eq("club_id", clubId)
    .eq("wa_contact_id", waContactId);

  convQuery = waGroupId ? convQuery.eq("wa_group_id", waGroupId) : convQuery.is("wa_group_id", null);

  let { data: conversation } = await convQuery.maybeSingle();

  if (!conversation) {
    const { data: created, error: createError } = await db
      .from("conversations")
      .insert({
        club_id: clubId,
        wa_contact_id: waContactId,
        wa_group_id: waGroupId ?? null,
        player_name: playerName ?? null,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !created) throw new Error(`Failed to create conversation: ${createError?.message}`);
    conversation = created;
  } else {
    // Session TTL — if idle for more than SESSION_TTL_DAYS, clear message history
    if (conversation.last_message_at) {
      const daysSince =
        (Date.now() - new Date(conversation.last_message_at).getTime()) / 86400000;
      if (daysSince > SESSION_TTL_DAYS) {
        log.info("[agent] session expired — clearing history", {
          conversationId: conversation.id,
          clubId,
          daysSince: Math.round(daysSince),
        });
        await db.from("messages").delete().eq("conversation_id", conversation.id);
      }
    }

    // Update player name if newly available
    if (playerName && !conversation.player_name) {
      const { data: updated } = await db
        .from("conversations")
        .update({ player_name: playerName, last_message_at: new Date().toISOString() })
        .eq("id", conversation.id)
        .select()
        .single();
      if (updated) conversation = updated;
    } else {
      // Always touch last_message_at so the TTL resets on each interaction
      await db
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversation.id);
    }
  }

  // Persist incoming user message
  await db.from("messages").insert({
    conversation_id: conversation.id,
    role: Role.USER,
    content: incomingText,
  });

  // Load recent history
  const { data: history } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY);

  // Reconstruct LLM message history with proper tool_use + tool_result pairing.
  // Assistant messages that triggered tool calls have their full ToolCall array stored in
  // tool_use_block. Tool result messages (role = TOOL) are included only when the preceding
  // reconstructed message has toolCalls — this handles both new data (with tool_use_block)
  // and old data (without) gracefully.
  const llmMessages: Message[] = [];
  for (const m of history ?? []) {
    if (m.role === Role.ASSISTANT && m.tool_use_block) {
      // Intermediate assistant turn — carry the tool_use blocks for Anthropic API pairing
      llmMessages.push({
        role: "assistant",
        content: m.content,
        toolCalls: m.tool_use_block as unknown as ToolCall[],
      });
    } else if (m.role === Role.TOOL) {
      // Only include if the preceding reconstructed message has toolCalls (avoids orphaned pairs)
      const prev = llmMessages[llmMessages.length - 1];
      if (prev?.role === "assistant" && prev.toolCalls?.length) {
        llmMessages.push({
          role: "tool",
          content: m.content,
          toolCallId: m.tool_call_id ?? "",
          toolName: m.tool_name ?? "",
        });
      }
    } else if (m.role === Role.USER || m.role === Role.ASSISTANT) {
      llmMessages.push({
        role: m.role === Role.USER ? "user" : "assistant",
        content: m.content,
      });
    }
  }

  const llm = getDefaultLLMProvider();
  const systemPrompt = buildSystemPrompt(club, playerName ?? conversation.player_name ?? null);
  const bookingProvider = createBookingProvider(
    club.booking_platform,
    club.booking_config as Record<string, unknown>
  );

  let assistantResponse = "";

  // Agentic loop
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await llm.chat({
      messages: llmMessages,
      tools: BOOKING_TOOLS,
      systemPrompt,
      maxTokens: 1024,
    });

    if (response.content) assistantResponse = response.content;

    if (response.stopReason !== "tool_use" || !response.toolCalls?.length) break;

    const toolNames = response.toolCalls.map((t) => t.name).join(", ");
    const assistantContent = response.content
      ? `${response.content}\n[Tools: ${toolNames}]`
      : `[Tools: ${toolNames}]`;

    // Persist the assistant turn with tool_use_block for accurate history reconstruction
    await db.from("messages").insert({
      conversation_id: conversation.id,
      role: Role.ASSISTANT,
      content: assistantContent,
      metadata: { toolCalls: response.toolCalls } as unknown as Json,
      tool_use_block: response.toolCalls as unknown as Json,
    });

    llmMessages.push({ role: "assistant", content: response.content ?? "", toolCalls: response.toolCalls });

    for (const toolCall of response.toolCalls) {
      const toolResult = await executeTool(toolCall.name, toolCall.input, {
        bookingProvider,
        playerPhone: waContactId,
        clubId,
        conversationId: conversation.id,
        playerName: playerName ?? conversation.player_name ?? undefined,
      });

      log.info("[agent] tool executed", {
        tool: toolCall.name,
        clubId,
        conversationId: conversation.id,
      });

      await db.from("messages").insert({
        conversation_id: conversation.id,
        role: Role.TOOL,
        content: toolResult,
        tool_name: toolCall.name,
        tool_call_id: toolCall.id,
        metadata: { input: toolCall.input } as unknown as Json,
      });

      llmMessages.push({
        role: "tool",
        content: toolResult,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
      });
    }
  }

  // Persist final assistant response
  if (assistantResponse) {
    await db.from("messages").insert({
      conversation_id: conversation.id,
      role: Role.ASSISTANT,
      content: assistantResponse,
    });
  }

  log.info("[agent] turn complete", { clubId, conversationId: conversation.id });

  return assistantResponse || "Sorry, I wasn't able to process that. Please try again.";
}
