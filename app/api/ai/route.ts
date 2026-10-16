import { NextResponse } from "next/server";

/**
 * /api/ai — AI provider proxy (client-key model).
 *
 * GET  — provider status probe. Reports ONLY whether server-side provider
 *        keys are configured (never the keys).
 * POST — forwards a single AI request to the caller's chosen free-tier
 *        provider. The API key arrives in the request body, is used for this
 *        one upstream call only, and is never stored or logged.
 *
 * POST body: { provider: "gemini"|"groq"|"openrouter", apiKey: string,
 *              model?: string, prompt: string, system?: string }
 * Returns { text } on success, or { error, code } with an honest status:
 *   400 bad request · 401 bad/rejected key · 429 rate limited · 502 provider error
 */

const PROVIDER_IDS = new Set(["gemini", "groq", "openrouter"]);

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  groq: "openai/gpt-oss-120b",
  openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
};

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Map an upstream failure to an honest, key-safe error response. */
function upstreamError(provider: string, status: number) {
  // Never echo the upstream body — it can contain key fragments.
  if (status === 401 || status === 403) {
    return err(
      "The provider rejected the API key. Check the key in Settings and try again.",
      "BAD_KEY",
      401,
    );
  }
  if (status === 429) {
    return err(
      "Rate limit reached on the free tier. Wait a minute and try again.",
      "RATE_LIMIT",
      429,
    );
  }
  if (status === 400) {
    return err(
      `The provider could not process this request (${provider}). Try a shorter prompt or a different model.`,
      "BAD_REQUEST",
      400,
    );
  }
  return err(
    `The ${provider} service returned an error (HTTP ${status}). Try again in a moment.`,
    "PROVIDER_ERROR",
    502,
  );
}

async function callGemini(apiKey: string, model: string, prompt: string, system?: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { status: res.status, text: "" };
  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("")?.trim() ?? "";
  return { text, status: 200 };
}

async function callOpenAICompatible(
  baseUrl: string,
  providerLabel: string,
  apiKey: string,
  model: string,
  prompt: string,
  system?: string,
) {
  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerLabel === "openrouter") {
    headers["HTTP-Referer"] = "https://sonet-stock-ai.vercel.app";
    headers["X-Title"] = "SONET STOCK AI";
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048 }),
  });
  if (!res.ok) return { status: res.status, text: "" };
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  return { text, status: 200 };
}

export async function GET() {
  const providers = [
    { id: "gemini", hasKey: Boolean(process.env.GEMINI_API_KEY) },
    { id: "openai", hasKey: Boolean(process.env.OPENAI_API_KEY) },
    { id: "anthropic", hasKey: Boolean(process.env.ANTHROPIC_API_KEY) },
  ];
  return NextResponse.json({
    configured: providers.some((p) => p.hasKey),
    providers,
  });
}

export async function POST(req: Request) {
  let body: {
    provider?: string;
    apiKey?: string;
    model?: string;
    prompt?: string;
    system?: string;
  };
  try {
    body = await req.json();
  } catch {
    return err("Request body must be valid JSON.", "INVALID_JSON", 400);
  }

  const { provider, apiKey, model, prompt, system } = body;

  if (!provider || !PROVIDER_IDS.has(provider)) {
    return err("Unknown provider. Use gemini, groq, or openrouter.", "UNKNOWN_PROVIDER", 400);
  }
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
    return err("A valid API key is required. Add one in Settings.", "MISSING_KEY", 400);
  }
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return err("A prompt is required.", "MISSING_PROMPT", 400);
  }
  if (prompt.length > 12000) {
    return err("Prompt is too long (max 12,000 characters).", "PROMPT_TOO_LONG", 400);
  }

  const key = apiKey.trim();
  const useModel = (model && model.trim()) || DEFAULT_MODELS[provider];
  // Basic model sanity: printable, no path tricks.
  if (!/^[\w.:/-]{1,120}$/.test(useModel)) {
    return err("Invalid model name.", "BAD_MODEL", 400);
  }

  try {
    let result: { text: string; status: number };
    if (provider === "gemini") {
      result = await callGemini(key, useModel, prompt, system);
    } else if (provider === "groq") {
      result = await callOpenAICompatible("https://api.groq.com/openai/v1", "groq", key, useModel, prompt, system);
    } else {
      result = await callOpenAICompatible("https://openrouter.ai/api/v1", "openrouter", key, useModel, prompt, system);
    }

    if (result.status !== 200 || !result.text) {
      return upstreamError(provider, result.status);
    }
    return NextResponse.json({ text: result.text });
  } catch {
    return err(
      "Could not reach the AI provider. Check your connection and try again.",
      "NETWORK",
      502,
    );
  }
}
