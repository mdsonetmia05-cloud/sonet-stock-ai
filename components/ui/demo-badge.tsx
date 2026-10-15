import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Honesty badge shown on every tool page in this demo build. */
export function DemoBadge({ className, short }: { className?: string; short?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400",
        className,
      )}
      title="Demo mode: this build uses on-device heuristics and sample data. No real AI provider or marketplace data is connected."
    >
      <FlaskConical size={14} aria-hidden />
      {short ? "Demo mode" : "Demo mode — on-device heuristics & sample data"}
    </span>
  );
}
