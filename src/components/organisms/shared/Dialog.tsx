"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { Overline } from "@/components/atoms/Overline";
import { cn } from "@/lib/utils";

const dialogVariants = cva(
  // `open:flex`, not `flex`: a bare `flex` would override the UA `display:none`
  // on a closed <dialog> and flash the content inline before showModal() runs.
  "m-auto max-h-[92dvh] max-w-[calc(100%-3rem)] flex-col overflow-hidden rounded-lg bg-surface p-0 text-text-primary shadow-2xl open:flex backdrop:bg-text-primary/55 backdrop:backdrop-blur-xs max-md:mb-0 max-md:max-h-[96dvh] max-md:w-full max-md:max-w-full max-md:rounded-b-none",
  {
    variants: {
      size: {
        /** `.po-document-dialog` */
        document: "w-180",
        /** `.form-dialog` */
        default: "w-190",
        /** `.material-transfer-dialog` */
        wide: "w-270",
        /** `.material-purchase-dialog` / `.general-purchase-dialog` */
        xl: "w-290 max-w-[calc(100vw-2.25rem)]",
        /** `.po-preview-dialog` */
        preview: "w-320",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export type DialogProps = Omit<ComponentProps<"dialog">, "title" | "open"> &
  VariantProps<typeof dialogVariants> & {
    title: ReactNode;
    overline?: ReactNode;
    onClose: () => void;
    /** Accessible name of the header close button. */
    closeLabel?: string;
    /** Close when the backdrop is clicked. Off by default so forms do not lose input. */
    dismissOnBackdrop?: boolean;
    /** Rendered after children, e.g. a DialogFooter for dialogs without a <form>. */
    footer?: ReactNode;
  };

/**
 * Modal on native `<dialog>` + `showModal()`: focus trap, inert page, top layer
 * and scroll lock come from the browser. Mount it to open, unmount it to close.
 *
 * Children fill a flex column. A form should be
 * `<form className="flex min-h-0 flex-1 flex-col">` holding `DialogBody` and `DialogFooter`.
 */
export function Dialog({
  title,
  overline,
  onClose,
  closeLabel = "ปิดฟอร์ม",
  dismissOnBackdrop = false,
  footer,
  size,
  className,
  children,
  onCancel,
  onClick,
  ...props
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn(dialogVariants({ size }), className)}
      onCancel={(event) => {
        onCancel?.(event);
        // Escape: keep the element open and let the parent unmount it.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        onClick?.(event);
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
      {...props}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-6.5 py-5.5 max-md:p-4.5">
        <div className="min-w-0">
          {overline && <Overline>{overline}</Overline>}
          <h2 id={titleId} className="mt-1 text-h2">
            {title}
          </h2>
        </div>
        <IconButton label={closeLabel} icon={<X size={18} />} onClick={onClose} />
      </header>
      {children}
      {footer}
    </dialog>
  );
}
