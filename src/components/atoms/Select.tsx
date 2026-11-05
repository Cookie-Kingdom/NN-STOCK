"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  controlVariants,
  type ControlVariantProps,
} from "@/components/atoms/Input";
import { cn } from "@/lib/utils";

/** One choice of a `Select` or a `Combobox`; `label` is what is shown, the value when left
 *  out. `hint` is a quiet second text at the end of its row, e.g. a SKU. */
export type Option = { value: string; label?: string; hint?: string };

const labelOf = (option: Option) => option.label ?? option.value;

const coarse = "(pointer: coarse)";
/** True on a touch screen (phone, iPad): there the pickers are the device's own, its
 *  wheel, calendar and list, in place of the ones drawn here. False on the server. */
export const useTouch = () =>
  useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(coarse);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(coarse).matches,
    () => false,
  );

/** The device's own control (`<select>`, a date or time `<input>`) on a touch screen:
 *  16px text, under which iOS zooms in on focus. */
export const nativeControl = "text-body text-left";

/** The focused and the open look of a dropdown: the accent border inside a soft halo. */
export const dropdownFocus =
  "focus:border-accent focus:outline-3 focus:outline-offset-0 focus:outline-accent/20 aria-expanded:border-accent aria-expanded:outline-3 aria-expanded:outline-offset-0 aria-expanded:outline-accent/20";

/**
 * Shows the list of an open dropdown in the top layer (so a dialog never clips it) and
 * keeps it under its `anchor`, or above it when there is more room there. On touch it
 * scrolls the field up instead, so the list opens under it. Returns the ref of the list.
 */
export function useDropdown(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
) {
  const list = useRef<HTMLDivElement>(null);
  /** On touch: the field was scrolled up once since the list opened. */
  const lifted = useRef(false);
  // No dependency list: the list is placed again after every render while it is open,
  // because typing in a Combobox changes its height.
  useLayoutEffect(() => {
    const el = list.current;
    const control = anchor.current;
    if (!open) lifted.current = false;
    if (!open || !el || !control) return;
    if (el.showPopover && !el.matches(":popover-open")) el.showPopover();
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const place = () => {
      const box = control.getBoundingClientRect();
      // The part of the page on screen: on iOS the keyboard shrinks and pans the visual
      // viewport, while the rects and `fixed` stay in the layout viewport.
      const view = window.visualViewport;
      const viewTop = view?.offsetTop ?? 0;
      const viewBottom = viewTop + (view?.height ?? window.innerHeight);
      const gap = 6;
      const below = viewBottom - box.bottom - gap - 12;
      const above = box.top - viewTop - gap - 12;
      // scrollHeight is the whole list whatever its max-height: lifting the max-height to
      // measure would throw the list's own scroll back to the top.
      const need = Math.min(el.scrollHeight, 220);
      if (touch && below < need && !lifted.current) {
        // A phone opens the list under the field: first scroll the field to the top of
        // the screen, in the nearest box that scrolls, else the page.
        lifted.current = true;
        let scroller = control.parentElement;
        while (
          scroller &&
          !(
            scroller.scrollHeight > scroller.clientHeight &&
            /auto|scroll/.test(getComputedStyle(scroller).overflowY)
          )
        )
          scroller = scroller.parentElement;
        (scroller ?? window).scrollBy(0, box.top - viewTop - 12);
        return place();
      }
      // On touch it goes up only when even the lifted field has no usable room under it.
      const up = below < (touch ? 96 : need) && above > below;
      el.style.minWidth = `${box.width}px`;
      el.style.maxHeight = `${Math.max(Math.min(up ? above : below, 336), 96)}px`;
      el.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - el.offsetWidth - 8))}px`;
      // `top` either way: `bottom` would be measured from the layout viewport, which the
      // iOS keyboard does not shrink.
      el.style.top = `${up ? Math.max(viewTop + 8, box.top - gap - el.offsetHeight) : box.bottom + gap}px`;
    };
    place();
    // Once per render (the active row moved), never on a scroll: the list's own scroll is
    // caught below too, and would be pulled back to the active row.
    el.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });
    const onScroll = (event: Event) => event.target !== el && place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    // iOS opens and closes the keyboard without a window resize.
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  });
  return list;
}

/**
 * The list of an open dropdown: one row per option, the chosen one in the accent colour
 * with a check, the `active` one (under the pointer or the arrow keys) tinted. Focus
 * stays on the control, which names the active row with `aria-activedescendant`
 * (`${id}-${index}`). `mark` is the typed text, shown strong inside each label.
 */
export function OptionList({
  id,
  ref,
  options,
  value,
  active,
  mark = "",
  onActive,
  onChoose,
}: {
  id: string;
  ref: RefObject<HTMLDivElement | null>;
  options: Option[];
  value: string;
  active: number;
  mark?: string;
  onActive: (index: number) => void;
  onChoose: (index: number) => void;
}) {
  return (
    <div
      ref={ref}
      id={id}
      role="listbox"
      popover="manual"
      className="fixed inset-auto m-0 w-max max-w-[calc(100vw-1rem)] animate-fade-in [scrollbar-width:thin] [scrollbar-color:var(--color-border-strong)_transparent] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-1.5 font-normal text-popover-foreground shadow-lg"
      // Focus stays on the control: a blur is what closes the list.
      onMouseDown={(event) => event.preventDefault()}
      // Inside a `<label>`, a click would go on to press the control again.
      onClick={(event) => event.preventDefault()}
    >
      {options.map((option, index) => {
        const label = labelOf(option);
        const at = mark ? label.toLowerCase().indexOf(mark.toLowerCase()) : -1;
        const chosen = option.value === value;
        return (
          <div
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={chosen}
            data-active={index === active || undefined}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-body-sm max-md:text-body data-active:bg-accent-subtle",
              chosen && "font-medium text-accent",
            )}
            onMouseMove={() => index !== active && onActive(index)}
            onClick={() => onChoose(index)}
          >
            {at < 0 ? (
              <span>{label}</span>
            ) : (
              <span className={cn(!chosen && "text-text-secondary")}>
                {label.slice(0, at)}
                <span className="font-medium text-text-primary">
                  {label.slice(at, at + mark.length)}
                </span>
                {label.slice(at + mark.length)}
              </span>
            )}
            {option.hint && (
              <span className="ml-auto shrink-0 text-caption font-normal text-text-secondary tabular-nums">
                {option.hint}
              </span>
            )}
            {chosen && <Check size={16} aria-hidden className="shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A dropdown to pick one of `options`, sharing Input's variants so it lines up with a
 * text field on the same row. `onChange` gets the chosen value. The option whose value
 * is `""` is the "nothing chosen" one and reads as a placeholder. For a field that also
 * takes typed text, use `Combobox`.
 *
 * Keyboard: Enter, Space or an arrow opens the list; arrows, Home and End move; Enter
 * picks; Escape closes; typing the start of a label jumps to it.
 *
 * On a touch screen it is the device's own `<select>`.
 */
export function Select({
  variant,
  className,
  options,
  value,
  onChange,
  ...props
}: Omit<ComponentProps<"button">, "value" | "onChange" | "children"> &
  ControlVariantProps & {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
  }) {
  const id = useId();
  const control = useRef<HTMLButtonElement>(null);
  /** The row under the pointer or the arrow keys; `null` while the list is closed. */
  const [active, setActive] = useState<number | null>(null);
  const typed = useRef({ text: "", at: 0 });
  const open = active !== null && options.length > 0;
  const list = useDropdown(open, control);
  const chosen = options.findIndex((option) => option.value === value);
  const touch = useTouch();

  if (touch)
    return (
      <select
        {...(props as ComponentProps<"select">)}
        value={value}
        data-value={value}
        className={cn(
          controlVariants({ variant }),
          nativeControl,
          dropdownFocus,
          !value && "text-text-secondary",
          className,
        )}
        onChange={(event) => onChange(event.target.value)}
      >
        {/* A value off the list still reads as itself, as on the button. */}
        {chosen < 0 && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {labelOf(option)}
          </option>
        ))}
      </select>
    );

  const show = () => setActive(Math.max(chosen, 0));
  const choose = (index: number) => {
    setActive(null);
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;
    const last = options.length - 1;
    if (key === "Escape") {
      if (!open) return;
      // Inside a Dialog, Escape closes the list and leaves the form open.
      event.preventDefault();
      event.stopPropagation();
      setActive(null);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      if (!open) show();
      else
        setActive(
          Math.max(0, Math.min(last, active + (key === "ArrowDown" ? 1 : -1))),
        );
    } else if (open && (key === "Home" || key === "End")) {
      event.preventDefault();
      setActive(key === "Home" ? 0 : last);
    } else if (
      key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const fresh = event.timeStamp - typed.current.at > 600;
      const text = (fresh ? "" : typed.current.text) + key.toLowerCase();
      typed.current = { text, at: event.timeStamp };
      const hit = options.findIndex((option) =>
        labelOf(option).toLowerCase().startsWith(text),
      );
      if (hit < 0) return;
      if (open) setActive(hit);
      else choose(hit);
    }
  };

  return (
    <>
      <button
        ref={control}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        data-value={value}
        className={cn(
          controlVariants({ variant }),
          "group/select flex cursor-pointer items-center justify-between gap-2 text-left",
          variant === "filter" && "inline-flex",
          dropdownFocus,
          !value && "text-text-secondary",
          className,
        )}
        onClick={() => (open ? setActive(null) : show())}
        onKeyDown={onKeyDown}
        // Firefox presses a button on the keyup of Space.
        onKeyUp={(event) => event.key === " " && event.preventDefault()}
        onBlur={() => setActive(null)}
        {...props}
      >
        <span className="min-w-0 truncate">
          {chosen < 0 ? value : labelOf(options[chosen])}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className="shrink-0 text-text-secondary transition-transform duration-(--motion-base) ease-(--ease-enter) group-aria-expanded/select:rotate-180"
        />
      </button>
      {open && (
        <OptionList
          id={id}
          ref={list}
          options={options}
          value={value}
          active={active}
          onActive={setActive}
          onChoose={choose}
        />
      )}
    </>
  );
}
