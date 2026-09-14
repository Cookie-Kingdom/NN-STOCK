import type { ComponentProps } from "react";
import {
  controlVariants,
  type ControlVariantProps,
} from "@/components/atoms/Input";
import { cn } from "@/lib/utils";

export function Select({
  variant,
  reason,
  className,
  ...props
}: ComponentProps<"select"> & ControlVariantProps) {
  return (
    <select
      className={cn(
        controlVariants({ variant, reason }),
        // `.table-filter select`: wider, with room for the native arrow.
        variant === "filter" && "min-w-37.5 pr-8.5",
        className,
      )}
      {...props}
    />
  );
}
