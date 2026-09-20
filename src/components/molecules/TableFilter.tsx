import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One labelled filter control in a `FilterBar`: a `<label>` that lays its text and its
 * control out on a single line. Put an `Input` or `Select` with `variant="filter"`
 * inside — the label wraps the control, so no `htmlFor`/`id` pairing is needed.
 */
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
