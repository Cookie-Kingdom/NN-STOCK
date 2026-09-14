import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** `.table-section` + `.table-title` — bordered card with a title bar (title, count, actions). */
export function TableSection({
  title,
  count,
  actions,
  className,
  children,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  title: ReactNode;
  /** Small muted text next to the title, e.g. "12 แถว". */
  count?: ReactNode;
  /** Right side of the title bar; stacks under the title below md. */
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "my-7 overflow-hidden rounded-lg border border-border bg-surface shadow-xs",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-5 max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-h3">{title}</h2>
          {count !== undefined && (
            <span className="text-caption text-text-secondary">{count}</span>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
