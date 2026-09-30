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
  /** Right side of the title bar; drops to its own line when it does not fit beside
   *  the title, and stacks under it below md. */
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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border px-6 py-5 max-md:flex-col max-md:items-stretch">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-h3">{title}</h2>
          {count !== undefined && (
            <span className="text-caption whitespace-nowrap text-text-secondary">
              {count}
            </span>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
