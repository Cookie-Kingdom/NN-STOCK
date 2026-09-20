import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type PanelProps = Omit<ComponentProps<"section">, "ref"> & {
  as?: "section" | "div" | "article";
  /** `.panel.compact` */
  compact?: boolean;
  /** No padding — for a molecule that sets its own (KpiCard, ChartPanel). */
  flush?: boolean;
};

/**
 * Plain bordered surface — the default container for one block of a workspace.
 * `compact` tightens the padding for dense side-by-side panels, `flush` drops it for
 * a molecule that sets its own, and `as` swaps the tag when `<section>` is wrong for
 * the document outline.
 */
export function Panel({
  as: Tag = "section",
  compact = false,
  flush = false,
  className,
  ...props
}: PanelProps) {
  return (
    <Tag
      className={cn(
        "min-w-0 rounded-lg border border-border bg-surface",
        !flush && "p-5.5 max-md:p-4",
        compact && "p-4",
        className,
      )}
      {...props}
    />
  );
}
