"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { cn } from "@/lib/utils";

/**
 * A modal `<dialog>`: centered over a dimmed backdrop, a full-screen sheet below md. The
 * header holds `title` (the dialog's name), `meta` beside it and the close button; Escape
 * and the close button call `onClose`. `children` fill the rest as a flex column, so a form
 * can scroll its body and keep its action row in view. Width goes in `className`.
 * Mount to open, unmount to close. React's `autoFocus` runs while the dialog is still
 * closed, so a control marked `data-autofocus` takes focus once it opens.
 */
export function Dialog({
  title,
  meta,
  onClose,
  className,
  children,
}: {
  title: ReactNode;
  /** Beside the title, e.g. a status badge. */
  meta?: ReactNode;
  onClose: () => void;
  className?: string;
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
      aria-labelledby={titleId}
      className={cn(
        "m-auto max-h-[92dvh] max-w-[calc(100%-3rem)] flex-col overflow-hidden rounded-lg bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-text-primary/55 open:flex open:animate-scale-in open:backdrop:animate-fade-in max-md:m-0 max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:w-full max-md:max-w-full max-md:rounded-none max-md:open:animate-fade-up dark:backdrop:bg-black/65",
        className,
      )}
      onCancel={(event) => {
        // Escape: keep the element open and let the parent unmount it.
        event.preventDefault();
        onClose();
      }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-6.5 py-5 max-md:p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id={titleId} className="m-0 text-h2">
            {title}
          </h2>
          {meta}
        </div>
        <IconButton label="ปิด" icon={<X size={18} />} onClick={onClose} />
      </header>
      {children}
    </dialog>
  );
}
