import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** `.table-filters` — wraps TableFilter / DateRangeFilter / buttons */
export function FilterBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-end gap-3", className)}
      {...props}
    />
  );
}
