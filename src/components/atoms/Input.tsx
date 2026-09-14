import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Shared by Input, Select and Textarea so the three controls stay identical. */
export const controlVariants = cva(
  "text-text-primary outline-none disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-secondary",
  {
    variants: {
      variant: {
        /** `.field input|select|textarea` */
        form: "mt-2 block min-h-11.5 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-body-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent",
        /** `.table-edit-control` */
        table:
          "min-h-9.5 w-37.5 rounded-md border-2 border-accent bg-bg px-2 py-1.5 text-right text-num-md tabular-nums inset-ring inset-ring-accent/10 focus:outline-3 focus:outline-accent/15",
        /** `.table-filter input|select` */
        filter:
          "min-w-36 rounded-md border border-border bg-surface px-2.5 py-2 text-body-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent",
      },
      /** `.reason-control` — free-text reason inside a table row */
      reason: {
        true: "min-w-52.5 text-left text-body-sm font-normal",
        false: "",
      },
    },
    defaultVariants: { variant: "form", reason: false },
  },
);

export type ControlVariantProps = VariantProps<typeof controlVariants>;

export function Input({
  variant,
  reason,
  className,
  ...props
}: ComponentProps<"input"> & ControlVariantProps) {
  return (
    <input
      className={cn(controlVariants({ variant, reason }), className)}
      {...props}
    />
  );
}
