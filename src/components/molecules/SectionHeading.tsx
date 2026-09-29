import type { ComponentProps, ReactNode } from "react";
import { Overline } from "@/components/atoms/Overline";
import { Panel } from "@/components/atoms/Panel";
import { Muted } from "@/components/atoms/Text";
import { cn } from "@/lib/utils";

/**
 * Heading for a block: optional `overline`, an `<h2>` `title`, an optional `description`
 * under it and `actions` on the right (stacking under the text below `md`).
 *
 * - Default: sits inside an existing panel and draws no surface of its own.
 * - `framed`: the heading of a view, rendered as the `Panel` itself. `actions` get a
 *   wrapping row, and `align` sets where they sit against the text (`end` lines them up
 *   with the last line, for a row of filter controls). Leave `title` out for a panel
 *   whose heading is only an `overline`, such as a filter bar.
 */
export function SectionHeading({
  framed = false,
  overline,
  title,
  description,
  actions,
  align = "center",
  className,
  ...props
}: Omit<ComponentProps<"section">, "title" | "children"> & {
  framed?: boolean;
  overline?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** `framed` only: where `actions` sit against the text. */
  align?: "center" | "end";
}) {
  if (framed)
    return (
      <Panel
        className={cn(
          "flex justify-between gap-6 max-md:flex-col max-md:items-stretch max-md:gap-3.5",
          align === "end" ? "items-end" : "items-center",
          className,
        )}
        {...props}
      >
        <div className="max-w-190">
          {overline && <Overline>{overline}</Overline>}
          {title && <h2 className="mb-3 text-h2">{title}</h2>}
          {description && <Muted>{description}</Muted>}
        </div>
        {actions && (
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            {actions}
          </div>
        )}
      </Panel>
    );
  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start",
        className,
      )}
      {...(props as ComponentProps<"div">)}
    >
      <div className="min-w-0">
        {overline && <Overline>{overline}</Overline>}
        {title && <h2 className="m-0 text-h2">{title}</h2>}
        {description && <Muted>{description}</Muted>}
      </div>
      {actions}
    </div>
  );
}
