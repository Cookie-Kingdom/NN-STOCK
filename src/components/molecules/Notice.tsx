import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { cn } from "@/lib/utils";

const noticeVariants = cva(
  "my-3.5 flex justify-between gap-3 rounded-lg border px-4 py-3.5 text-body",
  {
    variants: {
      tone: {
        /** `.notice` */
        info: "border-border bg-bg text-text-secondary",
        /** `.notice.success` */
        success: "border-success/30 bg-success-subtle text-success",
        /** `.notice.warning` */
        warning: "border-warning/40 bg-warning-subtle text-warning",
        /** `.notice.danger` */
        danger: "border-danger/40 bg-danger-subtle text-danger",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export type NoticeTone = NonNullable<
  VariantProps<typeof noticeVariants>["tone"]
>;

const roleByTone: Partial<Record<NoticeTone, string>> = {
  danger: "alert",
  success: "status",
};

export type NoticeProps = ComponentProps<"div"> &
  VariantProps<typeof noticeVariants> & {
    /** Button laid out at the end, vertically centred (`.onboarding-notice`). */
    action?: ReactNode;
    /** Renders a close IconButton labelled `dismissLabel`. */
    onDismiss?: () => void;
    /** Accessible name of the close button. */
    dismissLabel?: string;
  };

/**
 * Inline message box inside a panel or form — info, success, warning or danger by
 * `tone`. The tone also picks the ARIA role (`alert` for danger, `status` for success),
 * so a failed save is announced without any extra wiring; pass `role` to override.
 * `action` puts a button at the end of the row and `onDismiss` adds a close button.
 */
export function Notice({
  tone,
  action,
  onDismiss,
  dismissLabel = "ปิด",
  role,
  className,
  children,
  ...props
}: NoticeProps) {
  return (
    <div
      role={role ?? roleByTone[tone ?? "info"]}
      className={cn(
        noticeVariants({ tone }),
        (action || onDismiss) && "items-center",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onDismiss && (
        <IconButton
          label={dismissLabel}
          icon={<X size={16} />}
          onClick={onDismiss}
          className="-my-2"
        />
      )}
    </div>
  );
}
