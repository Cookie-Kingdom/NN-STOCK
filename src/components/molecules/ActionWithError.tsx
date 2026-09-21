import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A right-aligned action — a table-row button, a download button — with its own
 * error line stacked underneath. The message sits under the action, not beside
 * it: beside it, it widened the last table column past the scroll edge and read
 * as nothing. `errorClassName` is for the longer messages that have to wrap.
 */
export function ActionWithError({
  error,
  errorClassName,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  error?: ReactNode;
  errorClassName?: string;
}) {
  return (
    <div
      // min-content track: a plain auto track takes the button's min-w-22 as its floor, so a
      // squeezed table column would shrink below the label and buttons would overlap.
      className={cn(
        "grid grid-cols-[minmax(min-content,auto)] justify-items-end gap-1",
        className,
      )}
      {...props}
    >
      {children}
      {error && (
        <small
          role="alert"
          className={cn("text-caption text-danger", errorClassName)}
        >
          {error}
        </small>
      )}
    </div>
  );
}
