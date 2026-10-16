/**
 * lib/providers.ts — AI provider abstraction.
 *
 * Two kinds of providers exist:
 * 1. The built-in on-device engine — always available, runs in the browser.
 *    Image analysis, metadata assembly and prompt tools use it. No API key needed.
 * 2. Free-tier cloud providers (Gemini / Groq / OpenRouter) — optional, via the
 *    client-key model in lib/ai-providers.ts: the user pastes a free API key in
 *    Settings, it lives only in browser localStorage, and /api/ai POST forwards
 *    each request server-side with the key used transiently (never stored/logged).
 *    Legacy server-env keys (GEMINI_API_KEY etc.) are still reported by GET /api/ai.
 *
 * RULES:
 * - Never put API keys in frontend code or commit them anywhere.
 * - Never log or persist keys server-side.
 * - Never claim a server-side AI operation ran when it did not.
 */

export interface ServerProviderStatus {
  configured: boolean;
  providers: Array<{ id: string; hasKey: boolean }>;
}

/** Ask the server which providers have keys configured (no keys are returned). */
export async function fetchServerProviderStatus(): Promise<ServerProviderStatus> {
  try {
    const res = await fetch("/api/ai", { method: "GET" });
    if (!res.ok) return { configured: false, providers: [] };
    return (await res.json()) as ServerProviderStatus;
  } catch {
    return { configured: false, providers: [] };
  }
}
