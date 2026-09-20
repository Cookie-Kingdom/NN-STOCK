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

/**
 * Secondary body text — the supporting paragraph under a heading, or the quieter
 * half of a line. `<p>` by default; pass `as="span"` when it has to sit inside a
 * sentence or a flex row that a block element would break.
 */
export function Muted({ as, className, ...props }: MutedProps) {
  const classes = cn("text-text-secondary", className);
  if (as === "span")
    return <span className={classes} {...(props as ComponentProps<"span">)} />;
  return <p className={classes} {...(props as ComponentProps<"p">)} />;
}

/**
 * The closing note under a panel or form: the smallest text in the system, with the
 * gap above it already built in. Use it for the one trailing line a block ends on —
 * `Caption` is the right choice when the text belongs to a particular field or cell.
 */
export function Footnote({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("mt-4 text-caption text-text-secondary", className)}
      {...props}
    />
  );
}
