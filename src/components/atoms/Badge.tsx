import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-caption font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-text-secondary",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        danger: "bg-danger-subtle text-danger",
        /** Inverted — a transient confirmation ("saved") that must outrank the panel. */
        inverse: "bg-text-primary px-3 py-2 text-text-inverse",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

/**
 * Status chip. `neutral`, `success`, `warning` and `danger` map to the semantic
 * colours; `inverse` is the loud one, for a confirmation that must be noticed. The
 * text carries the meaning — the colour only reinforces it.
 */
export function Badge({
  tone,
  className,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
