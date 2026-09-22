import type { ComponentProps } from "react";
import {
  controlVariants,
  type ControlVariantProps,
} from "@/components/atoms/Input";
import { cn } from "@/lib/utils";

/**
 * Native `<select>` sharing Input's variants, so a dropdown and a text field on the
 * same row line up. Native on purpose: on a phone the OS wheel picker beats any
 * custom menu we would build.
 */
export function Select({
  variant,
  reason,
  prefilled,
  className,
  ...props
}: ComponentProps<"select"> & ControlVariantProps) {
  return (
    <select
      className={cn(
        controlVariants({ variant, reason, prefilled }),
        // `.table-filter select`: wider, with room for the native arrow.
        variant === "filter" && "min-w-37.5 pr-8.5",
        className,
      )}
      data-prefilled={prefilled || undefined}
      {...props}
    />
  );
}
