import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** `.button-row`; `compact` = `.button-row.compact-actions` (right-aligned table actions) */
export function ButtonRow({
  compact = false,
  className,
  ...props
}: ComponentProps<"div"> & { compact?: boolean }) {
  return (
    <div
      className={cn(
        "my-3 flex flex-wrap items-center gap-2.5",
        compact && "justify-end gap-2 *:min-w-auto",
        className,
      )}
      {...props}
    />
  );
}
