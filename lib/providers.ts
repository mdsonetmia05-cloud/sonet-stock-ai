/**
 * lib/providers.ts — AI provider abstraction.
 *
 * Two kinds of providers exist:
 * 1. The built-in on-device engine — always available, runs in the browser.
 *    Image analysis, metadata assembly and prompt tools use it. No API key needed.
 * 2. Server-side providers (Gemini / OpenAI / Anthropic) — optional. They are
 *    enabled by setting the matching API key as a server environment variable;
 *    /api/ai reports their status (never the keys).
 *
 * RULES:
 * - Never put API keys in frontend code, browser storage, or client requests.
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
