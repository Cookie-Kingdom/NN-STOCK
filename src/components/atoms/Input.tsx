"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Shared by Input, Select and Textarea so the three controls stay identical.
 *
 * `max-md:text-body` is 16px, not styling: below that iOS Safari/Chrome zooms the
 * page when a control takes focus, and the zoom leaves a purely vertical form
 * scrollable sideways. The `table` variant is already 16px (`text-num-md`). */
export const controlVariants = cva(
  "text-text-primary outline-transparent transition-[color,background-color,border-color,outline-color] duration-(--motion-fast) ease-(--ease-standard) disabled:cursor-not-allowed disabled:bg-bg disabled:text-text-secondary",
  {
    variants: {
      variant: {
        /** `.field input|select|textarea` */
        form: "mt-2 block min-h-11.5 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-body-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent max-md:text-body",
        /** `.table-edit-control` */
        table:
          "min-h-9.5 w-37.5 rounded-md border-2 border-accent bg-bg px-2 py-1.5 text-right text-num-md tabular-nums inset-ring inset-ring-accent/10 focus:outline-3 focus:outline-accent/15 pointer-coarse:min-h-11",
        /** `.table-filter input|select` */
        filter:
          "min-h-10 min-w-36 rounded-md border border-border bg-surface px-2.5 py-2 text-body-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent max-md:text-body pointer-coarse:min-h-11",
      },
    },
    defaultVariants: { variant: "form" },
  },
);

export type ControlVariantProps = VariantProps<typeof controlVariants>;

/** Hides the native number spinners. */
const noSpinner =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** A plain number with its thousands apart: "1000000.5" is "1,000,000.5". Anything else
 *  (a word, a second dot) stands as typed, for `mutate` to refuse in words. */
export const grouped = (text: string) => {
  const parts = /^(-?)(\d+)(\.\d*)?$/.exec(text);
  return parts
    ? parts[1] + parts[2].replace(/\B(?=(\d{3})+$)/g, ",") + (parts[3] ?? "")
    : text;
};

/**
 * Single-line control for text and numbers (a date is a `DatePicker`, a time a
 * `TimePicker`). `variant` says where it lives:
 * `form` inside a FormField, `table` in an editable table cell (right-aligned,
 * tabular), `filter` in a filter bar. All three stay 16px on mobile so iOS does not
 * zoom the page when the field takes focus.
 *
 * A `type="number"` field has no spinners and ignores the wheel and the up/down
 * arrows: they used to change a figure the user had already typed, silently. Pass
 * `spinner` where the steppers are wanted.
 *
 * A text field of figures (`inputMode` decimal or numeric, a string `value`) shows its
 * thousands apart as it is typed ("1,000,000"); `onChange` still reads the bare figure
 * ("1000000") from `event.target.value`.
 */
export function Input({
  variant,
  spinner,
  className,
  ...props
}: ComponentProps<"input"> & ControlVariantProps & { spinner?: boolean }) {
  const mute = props.type === "number" && !spinner;
  const { value, onChange, inputMode } = props;
  const figure =
    typeof value === "string" &&
    props.type !== "number" &&
    (inputMode === "decimal" || inputMode === "numeric");
  /** Where the caret was in the bare figure, to put it back once the commas moved. */
  const caret = useRef<{ el: HTMLInputElement; chars: number } | null>(null);
  useLayoutEffect(() => {
    const kept = caret.current;
    caret.current = null;
    if (!kept || document.activeElement !== kept.el) return;
    const text = kept.el.value;
    let at = 0;
    for (let seen = 0; seen < kept.chars && at < text.length; at++)
      if (text[at] !== ",") seen++;
    kept.el.setSelectionRange(at, at);
  });
  return (
    <input
      className={cn(controlVariants({ variant }), mute && noSpinner, className)}
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
      {...(figure && {
        value: grouped(value),
        onChange: (event) => {
          const el = event.target;
          const at = el.selectionStart ?? el.value.length;
          caret.current = {
            el,
            chars: el.value.slice(0, at).replace(/,/g, "").length,
          };
          el.value = el.value.replace(/,/g, "");
          onChange?.(event);
        },
      })}
    />
  );
}
