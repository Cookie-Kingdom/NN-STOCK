import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Label over a number (the old `.stat`). */
export function Stat({
  label,
  value,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-bg p-4 max-md:p-3",
        className,
      )}
      {...props}
    >
      <small className="block text-caption text-text-secondary">{label}</small>
      <strong className="mt-2.5 block text-num-lg [overflow-wrap:anywhere] tabular-nums max-md:text-num-md">
        {value}
      </strong>
    </div>
  );
}
