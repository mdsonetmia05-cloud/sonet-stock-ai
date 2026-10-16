/**
 * lib/ai-providers.ts — Free-tier AI provider integration (client-key model).
 *
 * How it works:
 * 1. The user pastes a FREE API key in Settings (Gemini, Groq or OpenRouter).
 * 2. The key + chosen model live ONLY in this browser's localStorage
 *    (prefix `ssai_provider_`). They are never written to server storage,
 *    never logged, and never baked into the code.
 * 3. `callAI()` sends the key transiently to this app's `/api/ai` route,
 *    which forwards the request server-side to the provider and returns
 *    the text. The key exists only inside that single request.
 *
 * RULES:
 * - Never log, persist, or expose API keys.
 * - Never claim AI output was produced when no provider is configured.
 */

export type ProviderId = "gemini" | "groq" | "openrouter";

export interface ProviderDef {
  id: ProviderId;
  name: string;
  description: string;
  keyUrl: string;
  models: string[];
  defaultModel: string;
  freeNote: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Google's flagship models via AI Studio.",
    keyUrl: "https://aistudio.google.com/apikey",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
    defaultModel: "gemini-2.5-flash",
    freeNote: "Free via AI Studio — no credit card required.",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Blazing-fast inference, OpenAI-compatible API.",
    keyUrl: "https://console.groq.com/keys",
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"],
    defaultModel: "openai/gpt-oss-120b",
    freeNote: "Generous free tier for personal use.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "One API for many models, including free ones.",
    keyUrl: "https://openrouter.ai/keys",
    models: [
      "nvidia/nemotron-3-super-120b-a12b:free",
      "deepseek/deepseek-r1-0528:free",
      "qwen/qwen3-235b-a22b:free",
    ],
    defaultModel: "nvidia/nemotron-3-super-120b-a12b:free",
    freeNote: "Free models marked :free — no card needed.",
  },
];

export interface ActiveProvider {
  id: ProviderId;
  apiKey: string;
  model: string;
}

const LS_ACTIVE = "ssai_provider_active";
const LS_KEY_PREFIX = "ssai_provider_key_";
const LS_MODEL_PREFIX = "ssai_provider_model_";

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — keys simply won't persist */
  }
}

function lsRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function listProviders(): ProviderDef[] {
  return PROVIDERS;
}

export function providerDef(id: ProviderId): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** The currently active provider, or null when none is configured. */
export function getActiveProvider(): ActiveProvider | null {
  if (typeof window === "undefined") return null;
  const id = lsGet(LS_ACTIVE) as ProviderId | null;
  if (!id || !providerDef(id)) return null;
  const apiKey = lsGet(LS_KEY_PREFIX + id);
  if (!apiKey) return null;
  const model = lsGet(LS_MODEL_PREFIX + id) || providerDef(id)!.defaultModel;
  return { id, apiKey, model };
}

/** Save a provider key + model and make it the active provider. */
export function setActiveProvider(id: ProviderId, apiKey: string, model?: string): void {
  const def = providerDef(id);
  if (!def) throw new Error(`Unknown provider: ${id}`);
  const key = apiKey.trim();
  if (!key) throw new Error("API key is empty.");
  lsSet(LS_KEY_PREFIX + id, key);
  lsSet(LS_MODEL_PREFIX + id, model?.trim() || def.defaultModel);
  lsSet(LS_ACTIVE, id);
}

/** Remove the active provider's key (and any stored keys/models). */
export function clearProvider(): void {
  if (typeof window === "undefined") return;
  const active = lsGet(LS_ACTIVE);
  for (const p of PROVIDERS) {
    lsRemove(LS_KEY_PREFIX + p.id);
    lsRemove(LS_MODEL_PREFIX + p.id);
  }
  if (active) lsRemove(LS_ACTIVE);
}

/** Stored (masked) key presence per provider, for Settings UI. Never returns keys. */
export function storedKeyInfo(): Array<{ id: ProviderId; hasKey: boolean; model: string }> {
  return PROVIDERS.map((p) => ({
    id: p.id,
    hasKey: Boolean(lsGet(LS_KEY_PREFIX + p.id)),
    model: lsGet(LS_MODEL_PREFIX + p.id) || p.defaultModel,
  }));
}

export class NoProviderError extends Error {
  code = "NO_PROVIDER";
  constructor() {
    super("No AI provider configured. Add a free API key in Settings to enable AI features.");
    this.name = "NoProviderError";
  }
}

export class AIRequestError extends Error {
  code: string;
  status?: number;
  constructor(message: string, code = "AI_ERROR", status?: number) {
    super(message);
    this.name = "AIRequestError";
    this.code = code;
    this.status = status;
  }
}

export interface CallAIOptions {
  /** Override the active provider for this call only. */
  provider?: ActiveProvider;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Call the active AI provider via this app's server proxy.
 * Returns the model's text. Throws NoProviderError when nothing is configured,
 * AIRequestError with an honest message on provider/transport failures.
 * The API key travels only inside this request — never logged or stored.
 */
export async function callAI(
  prompt: string,
  system?: string,
  opts: CallAIOptions = {},
): Promise<string> {
  const active = opts.provider ?? getActiveProvider();
  if (!active) throw new NoProviderError();

  let res: Response;
  try {
    res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: opts.signal,
      body: JSON.stringify({
        provider: active.id,
        apiKey: active.apiKey,
        model: active.model,
        prompt,
        system,
      }),
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new AIRequestError("Could not reach the AI service. Check your connection and try again.", "NETWORK");
  }

  let body: { text?: string; error?: string; detail?: string; code?: string };
  try {
    body = await res.json();
  } catch {
    throw new AIRequestError(`AI service returned an unreadable response (HTTP ${res.status}).`, "BAD_RESPONSE", res.status);
  }

  if (!res.ok || !body.text) {
    const msg = body.error || `AI request failed (HTTP ${res.status}).`;
    throw new AIRequestError(msg, body.code || "PROVIDER_ERROR", res.status);
  }
  return body.text;
}
