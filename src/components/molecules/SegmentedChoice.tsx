import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = { value: T; label: ReactNode };

/**
 * A row of mutually exclusive choices, one always picked — a radio group drawn as
 * joined buttons. Wraps onto a second line on a phone instead of overflowing.
 */
export function SegmentedChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** Accessible name of the group, e.g. what is being chosen. */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-1 rounded-md border border-border bg-bg p-1",
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => !checked && onChange(option.value)}
            className={cn(
              "min-h-10 cursor-pointer rounded-sm px-3.5 py-2 text-body-sm font-medium transition-colors duration-(--motion-fast) ease-(--ease-standard) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11",
              checked
                ? "bg-surface text-accent shadow-sm"
                : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
