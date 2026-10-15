import { NextResponse } from "next/server";

/**
 * GET /api/ai — provider status probe.
 * Reports ONLY whether server-side provider keys are configured (never the keys).
 * Demo build: all providers report hasKey=false unless env vars are set.
 */
export async function GET() {
  const providers = [
    { id: "gemini", hasKey: Boolean(process.env.GEMINI_API_KEY) },
    { id: "openai", hasKey: Boolean(process.env.OPENAI_API_KEY) },
    { id: "anthropic", hasKey: Boolean(process.env.ANTHROPIC_API_KEY) },
  ];
  return NextResponse.json({
    configured: providers.some((p) => p.hasKey),
    providers,
    note: "Demo build: client uses on-device heuristics. Set a key and implement the provider call to enable real AI.",
  });
}

/**
 * POST /api/ai — server-side AI call stub (501 until a provider is wired).
 * Body: { provider: "gemini"|"openai"|"anthropic", prompt: string }
 * Real implementations must run server-side only and never expose keys.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not configured", detail: "No AI provider is wired in this demo build. See PLAN.md." },
    { status: 501 },
  );
}
