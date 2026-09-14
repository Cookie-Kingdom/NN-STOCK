import type { ComponentProps, ReactNode } from "react";
import { Muted } from "@/components/atoms/Text";
import { cn } from "@/lib/utils";

/** `.section-heading` */
export function SectionHeading({
  title,
  description,
  actions,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title" | "children"> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)} {...props}>
      <div className="min-w-0">
        <h2 className="m-0 text-h2">{title}</h2>
        {description && <Muted>{description}</Muted>}
      </div>
      {actions}
    </div>
  );
}
