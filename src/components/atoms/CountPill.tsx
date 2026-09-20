import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const countPillVariants = cva("rounded-full font-bold tabular-nums", {
  variants: {
    variant: {
      /** `.menu-alert` — count pushed to the end of a sidebar nav item */
      menu: "ml-auto min-w-5 bg-danger px-1.5 py-0.5 text-center text-caption font-extrabold text-danger-fg",
      /** `.notification-count` — count overlaid on the corner of a (relative) icon button */
      overlay:
        "absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center border-2 border-surface bg-danger px-1 text-caption leading-none text-danger-fg",
      /** `.task-alert` — red text pill inside a table cell */
      task: "inline-flex items-center bg-danger-subtle px-2 py-1 text-caption text-danger",
    },
  },
  defaultVariants: { variant: "menu" },
});

/**
 * Red count of items still waiting for someone — pending tasks, unread alerts.
 * `menu` sits at the end of a sidebar nav item, `overlay` on the corner of a
 * (relatively positioned) icon button, `task` inside a table cell. Render it only
 * when the count is above zero; a pill reading 0 is noise.
 */
export function CountPill({
  variant,
  className,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof countPillVariants>) {
  return (
    <span
      className={cn(countPillVariants({ variant }), className)}
      {...props}
    />
  );
}
