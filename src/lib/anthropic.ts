import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null | undefined;

/** Lazily erzeugter Claude-Client, oder null, wenn kein ANTHROPIC_API_KEY gesetzt ist. */
export function claudeClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

export const CLAUDE_MODELL = "claude-sonnet-5-5";
