import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type MutedProps =
  | ({ as?: "p" } & ComponentProps<"p">)
  | ({ as: "span" } & ComponentProps<"span">);

/** `.muted` */
export function Muted({ as, className, ...props }: MutedProps) {
  const classes = cn("text-text-secondary", className);
  if (as === "span") return <span className={classes} {...(props as ComponentProps<"span">)} />;
  return <p className={classes} {...(props as ComponentProps<"p">)} />;
}

/** `.footnote` */
export function Footnote({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-4 text-caption text-text-secondary", className)} {...props} />;
}
