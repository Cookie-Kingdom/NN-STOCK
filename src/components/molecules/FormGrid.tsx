import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The two-column grid a form lays its FormField / FieldGroup children out on,
 * dropping to one column below `md`. A child marked `wide` spans every column
 * of it. The vertical margin is part of the grid, so it sits between two blocks
 * of a dialog body without the caller spacing it.
 */
export function FormGrid({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "my-4.5 grid grid-cols-2 gap-4.5 max-md:grid-cols-1 max-md:gap-4",
        className,
      )}
      {...props}
    />
  );
}
