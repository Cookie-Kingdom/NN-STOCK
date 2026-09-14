import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  "grid shrink-0 cursor-pointer place-items-center rounded-md transition-colors outline-none hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      size: {
        /** `.icon-button`: 44px touch target */
        md: "min-h-11 min-w-11",
        /** `.sidebar-account .icon-button`: 34px, muted */
        sm: "min-h-8.5 min-w-8.5 text-text-secondary",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type IconButtonProps = Omit<ComponentProps<"button">, "children"> &
  VariantProps<typeof iconButtonVariants> & {
    /** Required accessible name — becomes `aria-label` and `title`. */
    label: string;
    icon: ReactNode;
  };

export function IconButton({
  label,
  icon,
  size,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ size }), className)}
      {...props}
    >
      {icon}
    </button>
  );
}
