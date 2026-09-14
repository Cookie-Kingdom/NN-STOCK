import type { ComponentProps, ReactNode } from "react";
import {
  FieldHint,
  OptionalMark,
  fieldClassName,
} from "@/components/molecules/FormField";

/**
 * `.field` rendered as a `<div>` for fields that hold several controls
 * (e.g. PackWeightFields). Each control must carry its own `aria-label`.
 */
export function FieldGroup({
  label,
  optional = false,
  hint,
  wide = false,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={fieldClassName(wide, className)} {...props}>
      <span>
        {label}
        {optional && <OptionalMark />}
      </span>
      {hint && <FieldHint>{hint}</FieldHint>}
      {children}
    </div>
  );
}
