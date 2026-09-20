import type { ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils";

/**
 * `.form-dialog form > footer` / `.form-dialog > footer`.
 * Order: hint or error (left) · children · cancel · submit.
 */
export function DialogFooter({
  hint,
  error,
  cancelLabel = "ยกเลิก",
  onCancel,
  submitLabel,
  submitType = "submit",
  submitDisabled,
  submitting = false,
  onSubmit,
  className,
  children,
}: {
  hint?: ReactNode;
  /** What the form would be refused for, checked as the user types. Takes the
   *  hint's place: while something is wrong, that is the useful thing to read.
   *  Unlike the hint it stays visible on a phone, and it never hides the buttons. */
  error?: string;
  cancelLabel?: ReactNode;
  /** Cancel button is rendered only when this is given. */
  onCancel?: () => void;
  /** Submit button is rendered only when this is given. */
  submitLabel?: ReactNode;
  submitType?: "submit" | "button";
  submitDisabled?: boolean;
  /** Save in flight: the submit button spins and stays disabled until it settles. */
  submitting?: boolean;
  /** Click handler for the submit button (use with `submitType="button"`). */
  onSubmit?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <footer
      className={cn(
        "flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-bg px-6.5 py-4 max-md:px-4.5 max-md:py-3.5",
        className,
      )}
    >
      {error ? (
        <p
          role="alert"
          className="mr-auto min-w-40 flex-1 text-caption text-danger"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p className="mr-auto text-caption text-text-secondary max-md:hidden">
            {hint}
          </p>
        )
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
          disabled={submitDisabled || submitting}
          icon={submitting ? <Spinner /> : undefined}
          onClick={onSubmit}
        >
          {/* The label stays put while saving: only the spinner is added, so the
              footer keeps its width and nothing shifts under the cursor. */}
          {submitLabel}
        </Button>
      )}
    </footer>
  );
}
