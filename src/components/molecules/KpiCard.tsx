import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const kpiIconVariants = cva(
  "grid size-8 flex-none place-items-center rounded-lg",
  {
    variants: {
      tone: {
        sales: "bg-bg text-accent",
        cost: "bg-warning-subtle text-warning",
        positive: "bg-success-subtle text-success",
        negative: "bg-danger-subtle text-danger",
        boxes: "bg-accent-subtle text-accent",
      },
    },
    defaultVariants: { tone: "sales" },
  },
);

export type KpiTone = NonNullable<VariantProps<typeof kpiIconVariants>["tone"]>;

/** `.kpi-card` (+ `.kpi-title`, `.kpi-icon`, `small.gain|loss`) */
export function KpiCard({
  tone,
  icon,
  label,
  value,
  caption,
  captionTone,
  className,
  ...props
}: Omit<ComponentProps<"article">, "children"> &
  VariantProps<typeof kpiIconVariants> & {
    icon: ReactNode;
    label: ReactNode;
    value: ReactNode;
    caption?: ReactNode;
    /** `small.gain` / `small.loss` */
    captionTone?: "gain" | "loss";
  }) {
  return (
    <article
      className={cn(
        "grid min-w-0 gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2 text-label font-bold text-text-secondary">
        <span className={kpiIconVariants({ tone })}>{icon}</span>
        <span>{label}</span>
      </div>
      <strong className="text-num-lg text-text-primary tabular-nums xl:text-num-xl">
        {value}
      </strong>
      {caption && (
        <small
          className={cn(
            "min-w-0 text-body-sm text-text-secondary",
            captionTone === "gain" && "font-extrabold text-success",
            captionTone === "loss" && "font-extrabold text-danger",
          )}
        >
          {caption}
        </small>
      )}
    </article>
  );
}
