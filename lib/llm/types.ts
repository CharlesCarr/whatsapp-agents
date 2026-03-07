export interface Message {
  role: "user" | "assistant" | "tool";
  content: string | ContentBlock[];
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ToolCall[]; // present on assistant messages that triggered tool use
}

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMProvider {
  chat(params: {
    messages: Message[];
    tools?: Tool[];
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<LLMResponse>;
}

export interface LLMConfig {
  provider: "claude" | "openai";
  model: string;
  apiKey: string;
}
