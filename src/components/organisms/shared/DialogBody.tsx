import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** `.form-body` — the scrolling area between the Dialog header and DialogFooter. */
export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-auto px-6.5 py-5.5 max-md:p-4.5", className)}
      {...props}
    />
  );
}
