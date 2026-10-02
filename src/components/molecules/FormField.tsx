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

type FormFieldProps = Omit<ComponentProps<"label">, "children"> & {
  /** `div` (with a `<span>` label) for a field that holds several controls, e.g.
   *  several pack weights: a `<label>` around several inputs is invalid, so each control
   *  must carry its own `aria-label`. */
  as?: "label" | "div";
  label: ReactNode;
  /** Appends the " (ถ้ามี)" marker. */
  optional?: boolean;
  hint?: ReactNode;
  /** Spans every column of a `.form-grid`. */
  wide?: boolean;
  /** The control — use `Input` / `Select` / `Textarea` with `variant="form"`. */
  children: ReactNode;
};

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
    <label className={fieldClassName(wide, className)} {...props}>
      {label}
      {optional && <OptionalMark />}
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </label>
  );
}
