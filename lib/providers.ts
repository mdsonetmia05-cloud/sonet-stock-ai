/**
 * lib/providers.ts — AI provider abstraction.
 *
 * DEMO BUILD: no real provider is configured. getActiveProvider() always
 * returns the DemoProvider, which uses on-device heuristics and clearly
 * labeled template output. Server-side providers (Gemini/OpenAI/Anthropic)
 * are stubbed behind /api/ai and documented in PLAN.md + README.md.
 *
 * RULES:
 * - Never put API keys in frontend code, browser storage, or client requests.
 * - Never claim an AI operation succeeded when it did not run.
 */

export type ProviderId = "demo" | "server";

export interface ProviderResult {
  text: string;
  model: string;
  provider: string;
  demo: boolean;
}

export interface AIProvider {
  id: ProviderId;
  label: string;
  description: string;
  isConfigured(): boolean;
  generateText(prompt: string): Promise<ProviderResult>;
}

/** On-device heuristic provider. Output is templated and labeled as demo. */
export const demoProvider: AIProvider = {
  id: "demo",
  label: "Demo Provider (on-device heuristics)",
  description:
    "No API key configured. Text is assembled from on-device templates and image measurements — not a real AI model.",
  isConfigured: () => true,
  generateText: async (prompt: string): Promise<ProviderResult> => {
    // tiny artificial delay so loading states are visible
    await new Promise((r) => setTimeout(r, 350));
    return {
      text: `[Demo output — on-device heuristic, not a real AI model]\n\n${prompt}`,
      model: "demo-heuristic-v1",
      provider: "demo",
      demo: true,
    };
  },
};

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

/** Always the demo provider in this build. */
export function getActiveProvider(): AIProvider {
  return demoProvider;
}
