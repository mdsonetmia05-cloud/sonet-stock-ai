import { NextResponse } from "next/server";

/**
 * GET /api/ai — provider status probe.
 * Reports ONLY whether server-side provider keys are configured (never the keys).
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
  });
}

/**
 * POST /api/ai — server-side AI call (501 until a provider is wired).
 * Body: { provider: "gemini"|"openai"|"anthropic", prompt: string }
 * Implementations must run server-side only and never expose keys.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not configured", detail: "No server-side AI provider is wired yet. Set GEMINI_API_KEY, OPENAI_API_KEY or ANTHROPIC_API_KEY as a server environment variable." },
    { status: 501 },
  );
}
