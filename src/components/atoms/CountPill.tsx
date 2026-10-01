import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const countPillVariants = cva("rounded-full font-bold tabular-nums", {
  variants: {
    variant: {
      /** `.menu-alert` — count pushed to the end of a sidebar nav item */
      menu: "ml-auto min-w-5 bg-surface-sunken px-1.5 py-0.5 text-center text-caption font-extrabold text-text-secondary",
      /** `.notification-count` — count overlaid on the corner of a (relative) icon button */
      overlay:
        "absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center border-2 border-surface bg-surface-sunken px-1 text-caption leading-none text-text-secondary",
    },
  },
  defaultVariants: { variant: "menu" },
});

/**
 * Neutral count of things not recorded yet (the Badge `neutral` colours): a note, not an
 * alarm, so never red. `menu` sits at the end of a sidebar nav item, `overlay` on the
 * corner of a (relatively positioned) icon button. Render it only when the count is above
 * zero; a pill reading 0 is noise.
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
