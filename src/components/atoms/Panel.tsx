import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type PanelProps = Omit<ComponentProps<"section">, "ref"> & {
  as?: "section" | "div" | "article";
  /** `.panel.compact` */
  compact?: boolean;
};

/** `.panel` — plain bordered surface */
export function Panel({
  as: Tag = "section",
  compact = false,
  className,
  ...props
}: PanelProps) {
  return (
    <Tag
      className={cn(
        "min-w-0 rounded-lg border border-border bg-surface p-5.5 max-md:p-4",
        compact && "p-4",
        className,
      )}
      {...props}
    />
  );
}
