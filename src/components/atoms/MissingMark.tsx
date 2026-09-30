import { missingText } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Stands in for a value that was never filled: the entry was saved without it (GEN-02).
 *  Warning-coloured text, not a chip, so a column of them stays calm. */
export function MissingMark({ className }: { className?: string }) {
  return (
    <span className={cn("text-caption font-medium text-warning", className)}>
      {missingText}
    </span>
  );
}
