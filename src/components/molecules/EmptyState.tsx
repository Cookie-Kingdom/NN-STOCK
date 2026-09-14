import type { ReactNode } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Default → `.empty` (dashed box with icon; replaces primitives `Empty`).
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
          "mt-3.5 flex items-center gap-2 text-caption text-text-secondary",
          className,
        )}
      >
        {icon}
        {text}
      </p>
    );
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4.5 rounded-lg border border-dashed border-border px-6 py-15 text-center text-text-secondary",
        className,
      )}
    >
      {icon ?? <Package size={34} aria-hidden />}
      <p>{text}</p>
    </div>
  );
}
