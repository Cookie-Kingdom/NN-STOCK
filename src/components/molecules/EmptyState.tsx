import type { ReactNode } from "react";
import { Package } from "lucide-react";
import { Panel } from "@/components/atoms/Panel";
import { cn } from "@/lib/utils";

/**
 * Default → `.empty` (dashed box with icon).
 * `compact` → `.dashboard-alert-empty` / `.notification-empty` (a muted line, no icon unless given).
 */
export function EmptyState({
  text,
  icon,
  compact = false,
  className,
}: {
  text: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  if (compact)
    return (
      <p
        className={cn(
          "mt-3.5 flex animate-fade-in items-center gap-2 text-caption text-text-secondary",
          className,
        )}
      >
        {icon}
        {text}
      </p>
    );
  return (
    <Panel
      as="div"
      dashed
      flush
      className={cn(
        "flex animate-fade-in flex-col items-center justify-center gap-4.5 px-6 py-15 text-center text-text-secondary",
        className,
      )}
    >
      {icon ?? <Package size={34} aria-hidden />}
      <p>{text}</p>
    </Panel>
  );
}
