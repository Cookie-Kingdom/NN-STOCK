import type { ComponentProps } from "react";
import {
  controlVariants,
  type ControlVariantProps,
} from "@/components/atoms/Input";
import { cn } from "@/lib/utils";

/**
 * Multi-line control, sharing Input's variants so a note and a field match. It stays
 * vertically resizable; `compact` starts it one line high for a short reason or memo.
 */
export function Textarea({
  variant,
  reason,
  compact = false,
  className,
  ...props
}: ComponentProps<"textarea"> &
  ControlVariantProps & {
    /** `.field textarea.compact-note` — one-line height, user-resizable */
    compact?: boolean;
  }) {
  return (
    <textarea
      className={cn(
        controlVariants({ variant, reason }),
        "resize-y",
        compact && "h-11.5 min-h-11.5",
        className,
      )}
      {...props}
    />
  );
}
