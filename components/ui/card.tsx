import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow)]", className)}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex items-center justify-between gap-2", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold text-foreground", className)} {...rest} />;
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  sample,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
  sample?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {icon && <span className="text-primaryBright">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {sample && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            SAMPLE
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}
