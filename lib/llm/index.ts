import { ClaudeProvider } from "./claude";
import type { LLMConfig, LLMProvider } from "./types";

export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case "claude":
      return new ClaudeProvider(config.apiKey, config.model);
    case "openai":
      throw new Error("OpenAI provider not yet implemented");
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

export function getDefaultLLMProvider(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new ClaudeProvider(apiKey);
}

export * from "./types";
