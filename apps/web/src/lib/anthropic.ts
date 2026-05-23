import Anthropic from "@anthropic-ai/sdk";

const apiKey = import.meta.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn("[anthropic] ANTHROPIC_API_KEY is not set — API routes will fail at runtime.");
}

export const anthropic = new Anthropic({ apiKey: apiKey ?? "" });

export const MODEL_SONNET = "claude-sonnet-4-6" as const;
export const MODEL_HAIKU = "claude-haiku-4-5" as const;
