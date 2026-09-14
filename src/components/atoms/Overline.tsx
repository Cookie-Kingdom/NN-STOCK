import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const overlineVariants = cva("text-caption", {
  variants: {
    tone: {
      /** `.overline` */
      default: "font-semibold tracking-[0.07em] text-text-secondary",
      /** `.dashboard-refresh .overline` / `.dashboard-hero .overline` */
      accent: "font-extrabold tracking-[0.09em] text-accent",
    },
  },
  defaultVariants: { tone: "default" },
});

export function Overline({
  tone,
  className,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof overlineVariants>) {
  return <span className={cn(overlineVariants({ tone }), className)} {...props} />;
}
