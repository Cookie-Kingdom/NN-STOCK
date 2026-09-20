import type { ComponentProps, ReactNode } from "react";
import { Overline } from "@/components/atoms/Overline";
import { Panel } from "@/components/atoms/Panel";
import { cn } from "@/lib/utils";

/**
 * Panel around one dashboard chart: an optional overline, the `title`, a highlighted
 * `total` at the top right, and the chart itself as `children`. It wraps a flush
 * `Panel` and sets its own padding, so the chart drops straight in; `aside` takes
 * anything else that shares the heading row, such as a legend.
 */
export function ChartPanel({
  overline,
  title,
  total,
  totalTone = "warning",
  aside,
  className,
  children,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  overline?: ReactNode;
  title: ReactNode;
  /** Highlighted figure at the top right. */
  total?: ReactNode;
  /** `.chart-total` (warning) / `.chart-total.blue` (accent) */
  totalTone?: "warning" | "accent";
  /** Anything else for the heading's right side, e.g. a legend. */
  aside?: ReactNode;
}) {
  return (
    <Panel flush className={cn("px-6 py-5.5 shadow-xs", className)} {...props}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {overline && <Overline tone="accent">{overline}</Overline>}
          <h2 className="mt-1 text-h2 text-text-primary">{title}</h2>
        </div>
        {aside}
        {total !== undefined && (
          <span
            className={cn(
              "rounded-lg px-2.5 py-2 text-num-md font-extrabold tabular-nums",
              totalTone === "accent"
                ? "bg-accent-subtle text-accent"
                : "bg-warning-subtle text-warning",
            )}
          >
            {total}
          </span>
        )}
      </div>
      {children}
    </Panel>
  );
}
