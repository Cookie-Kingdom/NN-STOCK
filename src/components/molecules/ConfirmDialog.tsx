"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { Dialog } from "./Dialog";

/**
 * A centred ask before something is taken out: `title`, the line that says what happens,
 * 「ไม่ลบ」 (or Escape / ✕: `onClose`) and 「ยืนยันลบ」 (`onConfirm`). `saving` turns the
 * buttons off and spins the confirm; an `error` takes the message's place in red and keeps
 * the confirm off until the caller clears it.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel = "ยืนยันลบ",
  cancelLabel = "ไม่ลบ",
  saving = false,
  error = "",
  onConfirm,
  onClose,
}: {
  title: ReactNode;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  saving?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog size="sm" title={title} onClose={onClose}>
      <div className="px-6.5 py-4 text-body max-md:px-4">
        {error ? (
          <p role="alert" className="m-0 text-danger">
            {error}
          </p>
        ) : (
          <p className="m-0">{children}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-border px-6.5 py-3 max-md:px-4">
        <Button data-autofocus disabled={saving} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant="danger"
          disabled={saving || !!error}
          icon={saving ? <Spinner /> : undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
