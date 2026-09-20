import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One label/value line of a read-only detail list — lot summaries, modal recaps,
 * anything printed rather than edited. Values are right-aligned and tabular so
 * numbers line up down the column, and the last row drops its divider.
 */
export function ReadRow({
  label,
  value,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-5 border-b border-border py-3 text-body-sm last:border-0 max-md:gap-2.5",
        className,
      )}
      {...props}
    >
      <span className="text-text-secondary">{label}</span>
      <strong className="max-w-[65%] text-right font-medium [overflow-wrap:anywhere] whitespace-pre-wrap tabular-nums">
        {value}
      </strong>
    </div>
  );
}
