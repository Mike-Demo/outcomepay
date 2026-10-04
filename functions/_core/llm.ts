import { InputError } from "./http";

/**
 * Minimal LLM client abstraction for provider agents.
 * Supports OpenAI and Anthropic via direct REST (no SDK dependency).
 * When no key is configured, providers fall back to checked-in demo-cache
 * artifacts and label them mode:"cached" — never silently fake.
 */

export type LlmProvider = "openai" | "anthropic";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  /** Base URL for OpenAI-compatible providers (Groq, OpenRouter, …). */
  baseUrl: string;
}

export class LlmNotConfigured extends Error {
  constructor() {
    super("LLM_API_KEY is not set — using cached demo artifacts.");
    this.name = "LlmNotConfigured";
  }
}

function envVal(routeEnv: Record<string, unknown>, key: string): string | undefined {
  const v = routeEnv[key];
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

/** Resolve LLM config from env. Throws LlmNotConfigured when no key. */
export function llmConfig(routeEnv: Record<string, unknown>): LlmConfig {
  const apiKey = envVal(routeEnv, "LLM_API_KEY");
  if (!apiKey) throw new LlmNotConfigured();
  const provider = (envVal(routeEnv, "LLM_PROVIDER") ?? "openai").toLowerCase();
  if (provider !== "openai" && provider !== "anthropic") {
    throw new InputError("bad_llm_provider", 'LLM_PROVIDER must be "openai" or "anthropic".');
  }
  // Any OpenAI-compatible endpoint works here: api.openai.com (default),
  // api.groq.com/openai (free tier), openrouter.ai/api (free :free models).
  const baseUrl =
    envVal(routeEnv, "LLM_BASE_URL") ?? "https://api.openai.com/v1";
  let model = envVal(routeEnv, "LLM_MODEL");
  if (!model) {
    if (baseUrl.includes("groq.com")) model = "openai/gpt-oss-120b";
    else if (baseUrl.includes("openrouter.ai")) model = "openrouter/free";
    else model = provider === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4o-mini";
  }
  return { provider: provider as LlmProvider, apiKey, model, baseUrl };
}

async function llmText(cfg: LlmConfig, system: string, prompt: string): Promise<string> {
  if (cfg.provider === "openai") {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned no content.");
    return text;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300));
  const data = (await res.json()) as any;
  const text = (data?.content ?? []).map((b: any) => b.text ?? "").join("");
  if (!text) throw new Error("Anthropic returned no content.");
  return text;
}

/** Ask for a JSON object; strips accidental markdown fences. */
export async function llmJson(cfg: LlmConfig, system: string, prompt: string): Promise<any> {
  const text = await llmText(cfg, system, prompt + "\n\nRespond with JSON only. No markdown fences, no commentary.");
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}
