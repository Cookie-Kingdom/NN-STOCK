import type { ComponentProps, ReactNode } from "react";
import { Panel } from "@/components/atoms/Panel";
import { cn } from "@/lib/utils";

/** One day of the Daily Log: a card with the date at its head, the day's status pills at the
 *  right (`aside`) and the day's rows under it. `tone="warning"` tints the head yellow: a
 *  note of that day is not jotted yet. The tone is also `data-tone`, for the tests. */
export function DayCard({
  title,
  aside,
  tone = "ok",
  className,
  children,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  title: ReactNode;
  aside?: ReactNode;
  tone?: "ok" | "warning";
}) {
  const warning = tone === "warning";
  return (
    <Panel
      flush
      data-tone={tone}
      className={cn(
        "overflow-hidden",
        warning && "border-warning/40",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border px-5 py-3 last:border-b-0 max-md:px-4",
          warning && "border-warning/40 bg-warning-subtle",
        )}
      >
        <h3
          className={cn(
            "m-0 text-body font-semibold",
            warning && "text-warning",
          )}
        >
          {title}
        </h3>
        {aside && (
          <div className="flex flex-wrap items-center gap-1.5">{aside}</div>
        )}
      </div>
      {children}
    </Panel>
  );
}
