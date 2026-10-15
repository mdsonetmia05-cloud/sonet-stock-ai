import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "red" | "neutral" | "amber" | "blue";

const tones: Record<Tone, string> = {
  success: "bg-primary/15 text-primaryBright border-primary/30",
  red: "bg-danger/15 text-danger border-danger/30",
  neutral: "bg-secondary text-muted border-border",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
