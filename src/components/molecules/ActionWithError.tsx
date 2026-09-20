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
    <div className={cn("grid justify-items-end gap-1", className)} {...props}>
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
