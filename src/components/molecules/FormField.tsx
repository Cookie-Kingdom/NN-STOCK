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

export function OptionalMark() {
  return (
    <Caption as="span" className="font-normal">
      {" "}
      (ถ้ามี)
    </Caption>
  );
}

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

/** A `<label>` wrapping its control, so no `htmlFor`/`id` pairing is needed. */
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
