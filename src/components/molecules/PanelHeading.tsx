import type { ComponentProps, ReactNode } from "react";
import { Overline } from "@/components/atoms/Overline";
import { Panel } from "@/components/atoms/Panel";
import { Muted } from "@/components/atoms/Text";
import { cn } from "@/lib/utils";

/**
 * The heading of a view, rendered as the `Panel` itself: overline, `title`, an optional
 * `description`, and an `aside` for actions or stats that stacks under the text below
 * `md`. Use `SectionHeading` for a heading that sits inside an existing panel — this one
 * is the surface, not something you put on one.
 */
export function PanelHeading({
  overline,
  title,
  description,
  aside,
  className,
  ...props
}: Omit<ComponentProps<"section">, "title" | "children"> & {
  overline?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Actions or stats on the right; stacks under the text below md. */
  aside?: ReactNode;
}) {
  return (
    <Panel
      className={cn(
        "flex items-center justify-between gap-6 max-md:flex-col max-md:items-stretch max-md:gap-3.5",
        className,
      )}
      {...props}
    >
      <div className="max-w-190">
        {overline && <Overline>{overline}</Overline>}
        <h2 className="mb-3 text-h2">{title}</h2>
        {description && <Muted>{description}</Muted>}
      </div>
      {aside && (
        <div className="flex flex-none flex-wrap items-center gap-2.5">
          {aside}
        </div>
      )}
    </Panel>
  );
}
