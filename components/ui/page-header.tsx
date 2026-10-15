import { ReactNode } from "react";
import { DemoBadge } from "./demo-badge";

export function PageHeader({
  title,
  description,
  actions,
  demo = true,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  demo?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
          {demo && <DemoBadge />}
        </div>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
