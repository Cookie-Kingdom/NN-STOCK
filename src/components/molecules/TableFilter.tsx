import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** `.table-filter` — inline label + control. Use `Input`/`Select` with `variant="filter"`. */
export function TableFilter({
  label,
  className,
  children,
  ...props
}: Omit<ComponentProps<"label">, "children"> & {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-body-sm text-text-secondary",
        className,
      )}
      {...props}
    >
      {label}
      {children}
    </label>
  );
}
