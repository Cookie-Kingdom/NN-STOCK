import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type CaptionProps =
  | ({ as?: "small" } & ComponentProps<"small">)
  | ({ as: "span" } & ComponentProps<"span">);

/**
 * The small secondary line that sits under something else — a hint below a field,
 * the sub-line of a table cell, the name of a chosen file. `<small>` by default,
 * `as="span"` when it has to sit inside a sentence.
 */
export function Caption({ as, className, ...props }: CaptionProps) {
  const classes = cn("text-caption text-text-secondary", className);
  if (as === "span")
    return <span className={classes} {...(props as ComponentProps<"span">)} />;
  return <small className={classes} {...(props as ComponentProps<"small">)} />;
}

type MutedProps =
  | ({ as?: "p" } & ComponentProps<"p">)
  | ({ as: "span" } & ComponentProps<"span">);

/** Secondary text — a supporting paragraph, or a `span` when it sits inside a line. */
export function Muted({ as, className, ...props }: MutedProps) {
  const classes = cn("text-text-secondary", className);
  if (as === "span")
    return <span className={classes} {...(props as ComponentProps<"span">)} />;
  return <p className={classes} {...(props as ComponentProps<"p">)} />;
}

/** Quiet trailing note under a panel or form: the smallest text in the system. */
export function Footnote({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("mt-4 text-caption text-text-secondary", className)}
      {...props}
    />
  );
}
