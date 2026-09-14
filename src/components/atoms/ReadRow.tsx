import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** `.read-row` — replaces `Read` in shared/primitives.tsx */
export function ReadRow({
  label,
  value,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & { label: ReactNode; value: ReactNode }) {
  return (
    <div
      className={cn(
        "flex justify-between gap-5 border-b border-border py-3 text-body-sm last:border-0 max-md:gap-2.5",
        className,
      )}
      {...props}
    >
      <span className="text-text-secondary">{label}</span>
      <strong className="max-w-[65%] text-right font-medium whitespace-pre-wrap tabular-nums [overflow-wrap:anywhere]">
        {value}
      </strong>
    </div>
  );
}
