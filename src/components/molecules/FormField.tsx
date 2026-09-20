import type { ComponentProps, ReactNode } from "react";
import { Caption } from "@/components/atoms/Text";
import { cn } from "@/lib/utils";

/** `.field` / `.field.wide` — shared with FieldGroup. */
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
export function OptionalMark() {
  return (
    <Caption as="span" className="font-normal">
      {" "}
      (ถ้ามี)
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
  label,
  optional = false,
  hint,
  wide = false,
  className,
  children,
  ...props
}: FormFieldProps) {
  return (
    <label className={fieldClassName(wide, className)} {...props}>
      {label}
      {optional && <OptionalMark />}
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </label>
  );
}
