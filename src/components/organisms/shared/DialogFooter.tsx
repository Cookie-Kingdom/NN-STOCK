import type { ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/utils";

/**
 * `.form-dialog form > footer` / `.form-dialog > footer`.
 * Order: hint (left, hidden below md) · children · cancel · submit.
 */
export function DialogFooter({
  hint,
  cancelLabel = "ยกเลิก",
  onCancel,
  submitLabel,
  submitType = "submit",
  submitDisabled,
  onSubmit,
  className,
  children,
}: {
  hint?: ReactNode;
  cancelLabel?: ReactNode;
  /** Cancel button is rendered only when this is given. */
  onCancel?: () => void;
  /** Submit button is rendered only when this is given. */
  submitLabel?: ReactNode;
  submitType?: "submit" | "button";
  submitDisabled?: boolean;
  /** Click handler for the submit button (use with `submitType="button"`). */
  onSubmit?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <footer
      className={cn(
        "flex items-center justify-end gap-2.5 border-t border-border bg-bg px-6.5 py-4 max-md:px-4.5 max-md:py-3.5",
        className,
      )}
    >
      {hint && (
        <p className="mr-auto text-caption text-text-secondary max-md:hidden">
          {hint}
        </p>
      )}
      {children}
      {onCancel && (
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
      {submitLabel && (
        <Button
          variant="primary"
          type={submitType}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      )}
    </footer>
  );
}
