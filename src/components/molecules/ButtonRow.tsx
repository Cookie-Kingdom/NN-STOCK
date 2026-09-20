import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal row of buttons with the standard gap and vertical rhythm, wrapping on
 * narrow screens. `compact` right-aligns the row and drops the minimum button width,
 * which is what a table's inline row actions need.
 */
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
