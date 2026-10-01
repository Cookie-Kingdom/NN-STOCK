"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { Overline } from "@/components/atoms/Overline";
import { cn } from "@/lib/utils";

const dialogVariants = cva(
  // `open:flex`, not `flex`: a bare `flex` would override the UA `display:none`
  // on a closed <dialog> and flash the content inline before showModal() runs.
  // Phones get a full-screen sheet anchored to the top. A bottom-anchored one
  // (`m-auto mb-0`) sinks on iOS: a fixed box is laid out against the *large*
  // viewport, so its bottom edge lands behind Safari/Chrome's toolbars.
  "m-auto max-h-[92dvh] max-w-[calc(100%-3rem)] flex-col overflow-hidden rounded-lg bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-text-primary/55 backdrop:backdrop-blur-xs open:flex max-md:m-0 max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:w-full max-md:max-w-full max-md:rounded-none dark:backdrop:bg-black/65 " +
    // Motion: closed state is the exit (fast, accelerate); `open:` the settled state
    // (slow, decelerate); `starting:open:` the @starting-style the enter animates from.
    // ponytail: Dialog closes by unmounting, so today only the enter plays; the exit
    // styles apply if a caller ever calls close() on a mounted dialog.
    "translate-y-2 scale-96 opacity-0 transition-[opacity,translate,scale,display,overlay] transition-discrete duration-(--motion-base) ease-(--ease-exit) open:translate-y-0 open:scale-100 open:opacity-100 open:duration-(--motion-slow) open:ease-(--ease-enter) starting:open:translate-y-2 starting:open:scale-96 starting:open:opacity-0 " +
    "backdrop:opacity-0 backdrop:transition-[opacity,display,overlay] backdrop:transition-discrete backdrop:duration-(--motion-base) backdrop:ease-(--ease-exit) open:backdrop:opacity-100 open:backdrop:duration-(--motion-slow) open:backdrop:ease-(--ease-enter) starting:open:backdrop:opacity-0",
  {
    variants: {
      size: {
        /** `.po-document-dialog` */
        document: "w-180",
        /** `.form-dialog` */
        default: "w-190",
        /** sale: the day's own long form plus repeated influencer blocks. Wider than
         *  a form, still `max-w` capped, so a phone gets the same sheet. */
        formWide: "w-230",
        /** the transport document form */
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
    /** Rendered after children, e.g. a DialogFooter for dialogs without a <form>. */
    footer?: ReactNode;
    /** A strip under the header that stays put while the body scrolls, e.g. a
     *  SegmentedChoice that swaps which form the dialog shows. */
    toolbar?: ReactNode;
  };

let switchedAt = -Infinity;
let switchFocus = "";
/** Call right before swapping one dialog for another (a SegmentedChoice picking a
 *  sibling form): the dialog that mounts next skips its enter animation, so only the
 *  form changes instead of the whole popup replaying its open. `focus` is what takes
 *  focus in it: the chooser's picked option, or `[data-autofocus]` for a fresh form. */
export function skipNextDialogEnter(focus = '[aria-checked="true"]') {
  switchedAt = performance.now();
  switchFocus = focus;
}

/**
 * Modal on native `<dialog>` + `showModal()`: focus trap, inert page, top layer
 * and scroll lock come from the browser. Mount it to open, unmount it to close.
 *
 * Children fill a flex column. A form should be
 * `<form className="flex min-h-0 flex-auto flex-col">` holding `DialogBody` and `DialogFooter`.
 */
export function Dialog({
  title,
  overline,
  onClose,
  closeLabel = "ปิดฟอร์ม",
  footer,
  toolbar,
  size,
  className,
  children,
  onCancel,
  ...props
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // ponytail: time window, not a handshake; 500 ms covers the swap's render+commit.
  const [instant] = useState(() => performance.now() - switchedAt < 500);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!dialog.open) dialog.showModal();
    // React's autoFocus fires while the dialog is still closed, and showModal() then
    // focuses the first focusable (the close button). Hand focus back to the marked field.
    // After a swap, stay on the chooser's picked option rather than the close button.
    // A form that marks no field opens on its first control (ACC-18): Enter on the close
    // button would shut it.
    (
      dialog.querySelector<HTMLElement>(
        instant ? switchFocus : "[data-autofocus]",
      ) ??
      dialog.querySelector<HTMLElement>(
        "form :is(input, select, textarea):not([type=hidden], :disabled)",
      )
    )?.focus();
    return () => {
      if (dialog.open) dialog.close();
      previous?.focus();
    };
  }, [instant]); // fixed per mount

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn(
        dialogVariants({ size }),
        instant && "transition-none backdrop:transition-none",
        className,
      )}
      onCancel={(event) => {
        onCancel?.(event);
        // Escape: keep the element open and let the parent unmount it.
        event.preventDefault();
        onClose();
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
        <IconButton
          label={closeLabel}
          icon={<X size={18} />}
          onClick={onClose}
        />
      </header>
      {toolbar && (
        <div className="border-b border-border px-6.5 py-3 max-md:px-4.5">
          {toolbar}
        </div>
      )}
      {children}
      {footer}
    </dialog>
  );
}
