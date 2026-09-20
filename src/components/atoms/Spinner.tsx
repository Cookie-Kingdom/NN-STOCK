import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Busy indicator for buttons and loading panels.
 * The global reduced-motion guard freezes the spin, so every use pairs it with
 * text (visible, or `label` for screen readers) that says what is happening.
 */
export function Spinner({
  label,
  className,
}: {
  /** Screen-reader text when no visible label sits next to the spinner. */
  label?: string;
  className?: string;
}) {
  return (
    <>
      <LoaderCircle
        aria-hidden
        className={cn("size-4 shrink-0 animate-spin text-current", className)}
      />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}
