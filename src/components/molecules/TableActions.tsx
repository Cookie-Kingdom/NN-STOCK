import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The row of controls a table hands to `TableSection`'s `actions` slot: a note or
 * a button on one side, the sort and filter controls on the other. Below `md` the
 * two ends are pushed apart rather than left in a wrapped left-aligned stack.
 */
export function TableActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 max-md:justify-between",
        className,
      )}
      {...props}
    />
  );
}
