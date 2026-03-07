import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { LLMProvider, LLMResponse, Message, Tool } from "./types";

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-6") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(params: {
    messages: Message[];
    tools?: Tool[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<LLMResponse> {
    const { messages, tools, systemPrompt, maxTokens = 1024 } = params;

    // Convert our internal message format to Anthropic's MessageParam format
    // We always use string content to avoid type complexity with ContentBlockParam unions
    const formattedMessages: MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "tool") {
        // Tool results must be wrapped in user turn
        formattedMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId!,
              content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
            },
          ],
        });
      } else if (msg.role === "assistant") {
        if (msg.toolCalls?.length) {
          // Must include tool_use blocks so the following tool_result messages are valid
          const blocks: Anthropic.Messages.ContentBlockParam[] = [];
          if (msg.content) blocks.push({ type: "text", text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) });
          for (const tc of msg.toolCalls) {
            blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
          }
          formattedMessages.push({ role: "assistant", content: blocks });
        } else {
          formattedMessages.push({
            role: "assistant",
            content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
          });
        }
      } else if (msg.role === "user") {
        formattedMessages.push({
          role: "user",
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        });
      }
    }

    const anthropicTools: Anthropic.Tool[] | undefined = tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: formattedMessages,
      tools: anthropicTools,
    });

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const stopReason =
      response.stop_reason === "tool_use"
        ? "tool_use"
        : response.stop_reason === "max_tokens"
          ? "max_tokens"
          : "end_turn";

    return {
      content: textContent || null,
      toolCalls:
        toolUseBlocks.length > 0
          ? toolUseBlocks.map((block) => ({
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            }))
          : undefined,
      stopReason,
    };
  }
}
