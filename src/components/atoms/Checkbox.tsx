import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Checkbox for pick-the-rows forms — which materials to buy, which branch to send
 * to. Native on purpose: the OS control brings its own keyboard handling and
 * indeterminate state. Nothing visible sits inside the box, so every use needs a
 * name: a wrapping `<label>` or `aria-label`.
 */
export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4.5 shrink-0 cursor-pointer accent-accent outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
