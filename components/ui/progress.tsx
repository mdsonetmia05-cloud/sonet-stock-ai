import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  tone = "success",
}: {
  value: number; // 0-100
  className?: string;
  tone?: "success" | "red" | "info";
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          tone === "success" && "bg-primaryBright",
          tone === "red" && "bg-danger",
          tone === "info" && "bg-primaryBright",
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
