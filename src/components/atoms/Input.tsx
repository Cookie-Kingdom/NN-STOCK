import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Shared by Input, Select and Textarea so the three controls stay identical.
 *
 * `max-md:text-body` is 16px, not styling: below that iOS Safari/Chrome zooms the
 * page when a control takes focus, and the zoom leaves a purely vertical form
 * scrollable sideways. The `table` variant is already 16px (`text-num-md`). */
export const controlVariants = cva(
  "text-text-primary outline-none disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-secondary",
  {
    variants: {
      variant: {
        /** `.field input|select|textarea` */
        form: "mt-2 block min-h-11.5 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-body-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent max-md:text-body",
        /** `.table-edit-control` */
        table:
          "min-h-9.5 w-37.5 rounded-md border-2 border-accent bg-bg px-2 py-1.5 text-right text-num-md tabular-nums inset-ring inset-ring-accent/10 focus:outline-3 focus:outline-accent/15",
        /** `.table-filter input|select` */
        filter:
          "min-w-36 rounded-md border border-border bg-surface px-2.5 py-2 text-body-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent max-md:text-body",
      },
      /** `.reason-control` — free-text reason inside a table row */
      reason: {
        true: "min-w-52.5 text-left text-body-sm font-normal",
        false: "",
      },
      /** A value the system filled in (see `FormField`'s `prefilled`): `auto` is a
       *  faint tint, `expected` a predicted scale or count reading to check. */
      prefilled: {
        auto: "bg-accent-subtle/60",
        expected: "border-warning bg-warning-subtle inset-ring-warning/20",
      },
    },
    defaultVariants: { variant: "form", reason: false },
  },
);

export type ControlVariantProps = VariantProps<typeof controlVariants>;

/** Hides the native number spinners. */
const noSpinner =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/**
 * Single-line control for text, numbers and dates. `variant` says where it lives:
 * `form` inside a FormField, `table` in an editable table cell (right-aligned,
 * tabular), `filter` in a filter bar. All three stay 16px on mobile so iOS does not
 * zoom the page when the field takes focus.
 *
 * A `type="number"` field has no spinners and ignores the wheel and the up/down
 * arrows: they used to change a figure the user had already typed, silently. Pass
 * `spinner` where the steppers are wanted (PackingListTable).
 */
export function Input({
  variant,
  reason,
  prefilled,
  spinner,
  className,
  ...props
}: ComponentProps<"input"> & ControlVariantProps & { spinner?: boolean }) {
  const mute = props.type === "number" && !spinner;
  return (
    <input
      className={cn(
        controlVariants({ variant, reason, prefilled }),
        mute && noSpinner,
        className,
      )}
      data-prefilled={prefilled || undefined}
      onWheel={mute ? (event) => event.currentTarget.blur() : undefined}
      onKeyDown={
        mute
          ? (event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown")
                event.preventDefault();
            }
          : undefined
      }
      {...props}
    />
  );
}
