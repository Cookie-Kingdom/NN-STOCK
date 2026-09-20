import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The `<form>` a Dialog wraps around its DialogBody and DialogFooter. It is the
 * flex column the dialog's children are expected to fill, and `min-h-0` is the
 * part that matters: without it the body refuses to shrink and pushes the
 * footer out of the dialog instead of scrolling.
 */
export function DialogForm({ className, ...props }: ComponentProps<"form">) {
  return (
    <form
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}
