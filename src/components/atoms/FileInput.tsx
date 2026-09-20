import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * File picker. The browser draws the button itself, so the styling goes through
 * `file:` — the rest of the row is the file name the browser prints. It carries no
 * label of its own; FileUploadField wraps it with one, a size limit and a preview.
 */
export function FileInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="file"
      className={cn(
        "max-w-full text-caption file:mr-2.5 file:cursor-pointer file:rounded-sm file:border file:border-border-strong file:bg-surface file:px-2.5 file:py-2 file:font-semibold file:text-accent",
        className,
      )}
      {...props}
    />
  );
}
