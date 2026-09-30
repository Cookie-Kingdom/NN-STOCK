import type { ComponentProps, ReactNode } from "react";
import { Caption } from "@/components/atoms/Text";
import { cn } from "@/lib/utils";

/** `.field` / `.field.wide`. */
export function fieldClassName(wide?: boolean, className?: string) {
  return cn(
    "block min-w-0 text-body-sm font-medium",
    wide && "col-span-full",
    className,
  );
}

/**
 * The " (ถ้ามี)" marker that follows the label of a field which may be left blank.
 * `FormField` and `FileUploadField` add it from their `optional` prop, so render it by
 * hand only when a label is assembled outside those.
 */
export function OptionalMark({ text = "ถ้ามี" }: { text?: string }) {
  return (
    <Caption as="span" className="font-normal">
      {" "}
      ({text})
    </Caption>
  );
}

/**
 * The hint line under a control — a `Caption` with the block display and the gap above
 * it already set. `FormField` renders it from its `hint` prop, so reach for it directly
 * only when a field's layout is built by hand.
 */
export function FieldHint({ children }: { children: ReactNode }) {
  return <Caption className="mt-2 block">{children}</Caption>;
}

export type FormFieldProps = Omit<ComponentProps<"label">, "children"> & {
  /** `div` (with a `<span>` label) for a field that holds several controls, e.g.
   *  PackWeightFields: a `<label>` around several inputs is invalid, so each control
   *  must carry its own `aria-label`. `prefilled` is ignored. */
  as?: "label" | "div";
  label: ReactNode;
  /** Appends the " (ถ้ามี)" marker. */
  optional?: boolean;
  hint?: ReactNode;
  /** Spans every column of a `.form-grid`. */
  wide?: boolean;
  /** The control — use `Input` / `Select` / `Textarea` with `variant="form"`. */
  children: ReactNode;
  /** The system filled this value in: tints the control and says where it came from.
   *  `expected` marks a predicted scale or count reading the user must check. */
  prefilled?: { label: string; expected?: boolean };
};

/** The control inside a prefilled field, by `data-prefilled` on the label. Same look as
 *  `controlVariants`' `prefilled` variant. */
const prefilledControl =
  "data-[prefilled=auto]:[&_:is(input,select,textarea)]:bg-accent-subtle/60 data-[prefilled=expected]:[&_:is(input,select,textarea)]:border-warning data-[prefilled=expected]:[&_:is(input,select,textarea)]:bg-warning-subtle";

/**
 * The caption under a prefilled control: a short "filled by the system" mark, warning
 * coloured for a predicted reading. Where the value came from stays in the tooltip.
 * aria-hidden keeps it out of the field's accessible name, which the wrapping label
 * would otherwise extend.
 */
export function PrefillCaption({
  label,
  expected,
}: {
  label: string;
  expected?: boolean;
}) {
  return (
    <Caption
      aria-hidden
      title={label}
      className={cn("mt-1.5 block", expected && "font-medium text-warning")}
    >
      กรอกอัตโนมัติ
    </Caption>
  );
}

/**
 * One labelled control in a form: a `<label>` wrapping its control, so no `htmlFor`/`id`
 * pairing is needed and clicking the label focuses the field. Pass the control as
 * `children` — `Input`, `Select` or `Textarea` with `variant="form"` — and use `wide` to
 * make the field span every column of the surrounding form grid.
 */
export function FormField({
  as = "label",
  label,
  optional = false,
  hint,
  wide = false,
  prefilled,
  className,
  children,
  ...props
}: FormFieldProps) {
  if (as === "div")
    return (
      <div
        className={fieldClassName(wide, className)}
        {...(props as ComponentProps<"div">)}
      >
        <span>
          {label}
          {optional && <OptionalMark />}
        </span>
        {hint && <FieldHint>{hint}</FieldHint>}
        {children}
      </div>
    );
  return (
    <label
      className={fieldClassName(wide, cn(prefilledControl, className))}
      data-prefilled={
        prefilled ? (prefilled.expected ? "expected" : "auto") : undefined
      }
      {...props}
    >
      {label}
      {optional && <OptionalMark />}
      {children}
      {prefilled && <PrefillCaption {...prefilled} />}
      {hint && <FieldHint>{hint}</FieldHint>}
    </label>
  );
}
