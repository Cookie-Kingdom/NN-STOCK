"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { cn } from "@/lib/utils";

/**
 * Where a `DatePicker` or a `TimePicker` opens. One body, two presentations:
 *  - from md up, a panel under its `anchor`, or above it when there is more room there;
 *  - below md, a sheet at the bottom of the screen with `title` on top, so a calendar
 *    gets the width of the phone and cells a thumb can hit.
 *
 * Like the list of a `Select` it is a `popover` rendered beside its control: the top
 * layer keeps a `Dialog` from clipping it, and staying inside the dialog's subtree keeps
 * the modal from making it inert. The layer covers the screen; from md up it lets every
 * pointer event through and only the panel takes them.
 *
 * It closes on a press outside, on Escape (focus goes back to the anchor) and when focus
 * leaves it. The body marks the control that takes focus on open with `data-picker-focus`.
 */
export function PickerPopover({
  open,
  ...props
}: {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  /** Names the dialog and heads the sheet. */
  title: string;
  onClose: () => void;
  /** The panel's width from md up, e.g. `md:w-76`. */
  className?: string;
  children: ReactNode;
}) {
  return open ? <Layer {...props} /> : null;
}

function Layer({
  anchor,
  title,
  onClose,
  className,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  title: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // No dependency list: the panel is placed again after every render, because a body
  // may change its height (a calendar's month list).
  useLayoutEffect(() => {
    const el = layer.current;
    const box = panel.current;
    const control = anchor.current;
    if (!el || !box || !control) return;
    if (el.showPopover && !el.matches(":popover-open")) el.showPopover();
    const place = () => {
      const at = control.getBoundingClientRect();
      const height = window.visualViewport?.height ?? window.innerHeight;
      const gap = 6;
      const below = height - at.bottom - gap - 8;
      const above = at.top - gap - 8;
      const up = below < box.scrollHeight && above > below;
      const room = Math.max(up ? above : below, 160);
      const top = up
        ? Math.max(8, at.top - gap - Math.min(box.scrollHeight, room))
        : at.bottom + gap;
      const left = Math.max(
        8,
        Math.min(at.left, window.innerWidth - box.offsetWidth - 8),
      );
      // Read by the panel from md up only; below md it is a sheet and ignores them.
      el.style.setProperty("--picker-x", `${left}px`);
      el.style.setProperty("--picker-y", `${top}px`);
      el.style.setProperty("--picker-room", `${room}px`);
    };
    place();
    const onScroll = (event: Event) =>
      !box.contains(event.target as Node) && place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  });

  useEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>("[data-picker-focus]")
      ?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    // A press on the dimmed layer of the sheet is inside it, and closes it on the click.
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!layer.current?.contains(target) && !anchor.current?.contains(target))
        onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [anchor, onClose]);

  return (
    <div
      ref={layer}
      popover="manual"
      role="dialog"
      aria-label={title}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 font-normal text-popover-foreground max-md:flex max-md:animate-fade-in max-md:items-end max-md:bg-text-primary/55 md:pointer-events-none dark:max-md:bg-black/65"
      onClick={(event) => {
        // Inside a `<label>`, a click would go on to press the control again.
        event.preventDefault();
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // Inside a Dialog, Escape closes the picker and leaves the form open.
        event.preventDefault();
        event.stopPropagation();
        onClose();
        anchor.current?.focus();
      }}
      onBlur={(event) => {
        const to = event.relatedTarget;
        if (
          to &&
          !event.currentTarget.contains(to) &&
          !anchor.current?.contains(to)
        )
          onClose();
      }}
    >
      <div
        ref={panel}
        className={cn(
          "pointer-events-auto [scrollbar-width:thin] [scrollbar-color:var(--color-border-strong)_transparent] overflow-y-auto overscroll-contain border-border bg-popover shadow-lg max-md:max-h-[88dvh] max-md:w-full max-md:animate-fade-up max-md:rounded-t-lg max-md:border-t max-md:pb-[env(safe-area-inset-bottom)] md:absolute md:top-(--picker-y) md:left-(--picker-x) md:max-h-(--picker-room) md:animate-fade-in md:rounded-lg md:border",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border py-1 pr-1 pl-4 md:hidden">
          <span className="text-h3">{title}</span>
          <IconButton label="ปิด" icon={<X size={18} />} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
