import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The row of filters above a table: it wraps `TableFilter`, `BranchSelectFilter`,
 * date ranges and buttons, and wraps onto a second line when they do not fit. Children
 * align on their bottom edge, so a labelled control and a bare button sit level.
 */
export function FilterBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-end gap-3", className)}
      {...props}
    />
  );
}
