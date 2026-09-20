import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-(--motion-fast) ease-(--ease-standard) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring not-disabled:not-aria-disabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** `.primary` */
        primary:
          "gap-2 rounded-md border border-accent bg-accent text-body font-medium text-accent-fg hover:bg-accent-hover disabled:hover:bg-accent",
        /** `.secondary` */
        secondary:
          "gap-2 rounded-md border border-border bg-surface text-body font-medium text-text-primary hover:bg-bg disabled:hover:bg-surface",
        /** `.danger-button` */
        danger:
          "gap-2 rounded-md border border-danger/30 bg-danger-subtle text-body font-medium text-danger hover:bg-danger/10",
        /** `.table-action` */
        table:
          "min-w-22 gap-1.5 rounded-md border border-border bg-bg px-3 py-1.5 text-body-sm text-accent hover:bg-surface-sunken",
        /** `.secondary.table-action` — the table look keeps `.secondary`'s 44px height and weight */
        "table-secondary":
          "min-h-11 min-w-22 gap-1.5 rounded-md border border-border bg-bg px-3 py-1.5 text-body-sm font-medium text-accent hover:bg-surface-sunken",
        /** `.text-button` */
        text: "gap-1 text-right text-caption text-accent hover:text-accent-hover",
        link: "gap-1 text-accent underline-offset-4 hover:text-accent-hover hover:underline",
      },
      size: {
        /** `.primary` / `.secondary` default: 44px */
        md: "min-h-11 px-4 py-2.5",
        /** `.inline-table-action .primary|.secondary`: 36px */
        sm: "min-h-9 px-3 py-2",
        /** `.next-action .primary`: 48px */
        lg: "min-h-12 px-4 py-2.5",
        /** no box — for table / text / link variants */
        inline: "",
      },
    },
  },
);

type ButtonVariant = NonNullable<
  VariantProps<typeof buttonVariants>["variant"]
>;

const boxedVariants: ButtonVariant[] = ["primary", "secondary", "danger"];

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the single child (e.g. an `<a>`) with button styling. */
    asChild?: boolean;
    /** Rendered before children at 16px unless the icon sets its own `size-*` class. */
    icon?: ReactNode;
  };

/**
 * The only button in the app. `variant` picks the look: `primary`, `secondary` and
 * `danger` are boxed and default to a 44px touch target, while `table`, `text` and
 * `link` sit inline in a table row or a sentence. `size` overrides the height,
 * `icon` renders a 16px glyph before the label, and `asChild` gives an `<a>` the
 * button styling without nesting an anchor inside a button.
 */
export function Button({
  className,
  variant = "secondary",
  size,
  asChild = false,
  icon,
  type,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const resolvedSize =
    size ?? (boxedVariants.includes(variant ?? "secondary") ? "md" : "inline");
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size: resolvedSize }), className)}
      {...props}
    >
      {icon}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}
