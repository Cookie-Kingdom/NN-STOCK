"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";
/** 420 / 520 / 860 / 1280px: a confirm, a short note, a note with its rail, a PO document. */
const widths: Record<Size, string> = {
  sm: "w-105",
  md: "w-130",
  lg: "w-215",
  xl: "w-320",
};

/**
 * A modal `<dialog>`: centered over a dimmed backdrop, as wide as its `size`. The header
 * holds `title` (the dialog's name), one quiet `subtitle` line of context and the close
 * button; Escape and the close button call `onClose`. Below md, `sm` is a bottom sheet and
 * the other sizes are full-screen. `children` fill the rest as a flex column, so a form can
 * scroll its body and keep its action row in view.
 * Mount to open, unmount to close. React's `autoFocus` runs while the dialog is still
 * closed, so a control marked `data-autofocus` takes focus once it opens.
 */
export function Dialog({
  title,
  subtitle,
  size = "md",
  alert,
  onClose,
  children,
}: {
  title: ReactNode;
  /** Under the title, e.g. the PO and the date of the note. */
  subtitle?: ReactNode;
  size?: Size;
  /** A confirm: `role="alertdialog"`, described by the element of this id, and no close
   *  button. */
  alert?: { describedBy: string };
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal?.();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      role={alert ? "alertdialog" : undefined}
      aria-labelledby={titleId}
      aria-describedby={alert?.describedBy}
      className={cn(
        "m-auto max-h-[92dvh] max-w-[calc(100%-3rem)] flex-col overflow-hidden rounded-lg bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-text-primary/55 open:flex open:animate-scale-in open:backdrop:animate-fade-in max-md:w-full max-md:max-w-full max-md:open:animate-fade-up dark:backdrop:bg-black/65",
        widths[size],
        size === "sm"
          ? "max-md:mt-auto max-md:mb-0 max-md:rounded-b-none"
          : "max-md:m-0 max-md:h-dvh max-md:max-h-dvh max-md:rounded-none",
      )}
      onCancel={(event) => {
        // Escape: keep the element open and let the parent unmount it.
        event.preventDefault();
        onClose();
      }}
    >
      <header
        className={cn(
          "flex items-start justify-between gap-3 py-4 pr-3 pl-6.5 max-md:py-3 max-md:pr-2 max-md:pl-4",
          alert ? "pr-6.5 pb-0 max-md:pr-4" : "border-b border-border",
        )}
      >
        <div className="min-w-0 py-1">
          <h2 id={titleId} className="m-0 text-h2">
            {title}
          </h2>
          {subtitle && (
            <p className="m-0 text-body-sm text-text-secondary">{subtitle}</p>
          )}
        </div>
        {!alert && (
          <IconButton label="ปิด" icon={<X size={18} />} onClick={onClose} />
        )}
      </header>
      {children}
    </dialog>
  );
}
