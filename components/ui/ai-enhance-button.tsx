"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callAI, getActiveProvider } from "@/lib/ai-providers";

export interface AiPromptSpec {
  prompt: string;
  system?: string;
}

interface AiEnhanceButtonProps {
  /** Build the prompt from the page's current on-device result. Never fake AI output. */
  buildPrompt: () => AiPromptSpec;
  /** Called with the model's raw text on success — the page parses/displays it. */
  onResult: (text: string) => void;
  /** Called with an honest message when the AI request fails. */
  onError: (message: string) => void;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * "Enhance with AI" — an optional, additive second step on top of on-device logic.
 * When no AI provider is configured it renders disabled with a hint to Settings.
 */
export function AiEnhanceButton({
  buildPrompt,
  onResult,
  onError,
  label = "Enhance with AI",
  size = "sm",
  className,
}: AiEnhanceButtonProps) {
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHasProvider(getActiveProvider() !== null);
  }, []);

  const run = async () => {
    const active = getActiveProvider();
    if (!active) {
      setHasProvider(false);
      onError("No AI provider configured. Add a free API key in Settings to enable.");
      return;
    }
    setLoading(true);
    try {
      const { prompt, system } = buildPrompt();
      const text = await callAI(prompt, system);
      onResult(text);
    } catch (e) {
      onError(e instanceof Error ? e.message : "The AI request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const button = (
    <Button
      variant="primary"
      size={size}
      loading={loading}
      onClick={run}
      disabled={hasProvider === false}
      className={className}
    >
      {!loading && <Sparkles size={14} aria-hidden />}
      {loading ? "Enhancing…" : label}
    </Button>
  );

  if (hasProvider === false) {
    return (
      <div className="flex flex-col gap-1">
        {button}
        <p className="text-xs text-muted">
          Add a free API key in{" "}
          <Link href="/settings" className="text-primary underline hover:text-primaryBright">
            Settings
          </Link>{" "}
          to enable.
        </p>
      </div>
    );
  }

  return button;
}
