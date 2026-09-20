import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

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
