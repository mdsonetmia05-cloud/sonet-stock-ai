import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[] | string[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, className, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full cursor-pointer rounded-xl border border-border bg-secondary px-3 text-sm text-foreground",
        "focus:border-primary focus:outline-none transition-colors",
        className,
      )}
      {...rest}
    >
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>{o}</option>
        ) : (
          <option key={o.value} value={o.value}>{o.label}</option>
        ),
      )}
      {children}
    </select>
  ),
);
Select.displayName = "Select";
