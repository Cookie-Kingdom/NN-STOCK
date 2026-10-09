"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import {
  controlVariants,
  type ControlVariantProps,
} from "@/components/atoms/Input";
import { PickerPopover } from "@/components/atoms/PickerPopover";
import { dropdownFocus } from "@/components/atoms/Select";
import { minuteOptions, pad, parseTime, toTime } from "@/lib/pickers";
import { cn } from "@/lib/utils";

const hours = Array.from({ length: 24 }, (_, h) => h);

/** One scrolling list, of hours or of minutes. The list owns the arrow keys; its rows
 *  are the focus targets. `near` is the row it opens on while no time is chosen. */
function Column({
  ref,
  name,
  list,
  chosen,
  near,
  takesFocus = false,
  onPick,
  onKeyDown,
}: {
  ref: RefObject<HTMLDivElement | null>;
  name: string;
  list: number[];
  chosen?: number;
  near: number;
  takesFocus?: boolean;
  onPick: (n: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const tabStop = chosen ?? near;
  return (
    <div className="flex max-w-36 min-w-0 flex-1 flex-col">
      <span
        aria-hidden
        className="pb-1.5 text-center text-caption text-text-secondary"
      >
        {name}
      </span>
      {/* 5.5 rows: the half row says that the list scrolls. */}
      <div
        ref={ref}
        role="listbox"
        aria-label={name}
        className="relative flex h-55 [scrollbar-width:none] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-md bg-surface-sunken p-0.5 pointer-coarse:h-60.5"
        onKeyDown={onKeyDown}
      >
        {list.map((n) => (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={n === chosen}
            data-near={n === tabStop || undefined}
            data-picker-focus={takesFocus && n === tabStop ? "" : undefined}
            tabIndex={n === tabStop ? 0 : -1}
            className={cn(
              "grid h-9.5 shrink-0 place-items-center rounded-md text-body font-medium transition-colors duration-(--motion-fast) ease-(--ease-standard) focus-visible:-outline-offset-2 pointer-coarse:h-10.5",
              n === chosen
                ? "bg-accent font-semibold text-accent-fg"
                : "hover:bg-accent-subtle",
            )}
            onClick={() => onPick(n)}
          >
            {pad(n)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The app's time field, drawn instead of left to the browser's `<input type="time">`:
 * that one follows the device's 12 / 24-hour setting and opens a different wheel or
 * clock on every OS. This one is always 24-hour and is two short lists, hours and
 * minutes: under the field from md up, a sheet below md.
 *
 * `value` is an `HH:mm` string, `""` for none, and `onChange` gets the next one. Shares
 * Input's variants, so it lines up with a text field or a `Select` on the same row.
 *
 * `minuteStep` is 30: every time this app records lands on a half hour. A minute off
 * the step that an older entry already holds stays in the list, so reopening its form
 * never silently drops it.
 *
 * A press on an hour picks it and stays open; a press on a minute picks it and closes,
 * so the usual "hour, then minute" is two presses. `clearable` adds 「ล้าง」, which
 * gives `""`.
 *
 * Keyboard: up / down walk a list, left / right cross to the other; Enter picks; Escape
 * closes.
 */
export function TimePicker({
  variant,
  className,
  value,
  onChange,
  minuteStep = 30,
  placeholder = "เลือกเวลา",
  title = "เลือกเวลา",
  clearable = false,
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "value" | "onChange" | "children"> &
  ControlVariantProps & {
    value: string;
    onChange: (value: string) => void;
    minuteStep?: number;
    placeholder?: string;
    /** Names the two lists and heads the sheet below md: the field's own label. */
    title?: string;
    clearable?: boolean;
  }) {
  const control = useRef<HTMLButtonElement>(null);
  const hourList = useRef<HTMLDivElement>(null);
  const minuteList = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const current = parseTime(value);
  const shown = current ? toTime(current.h, current.m) : "";
  const minutes = minuteOptions(minuteStep, current?.m);

  const close = () => setOpen(false);
  const done = () => {
    close();
    control.current?.focus();
  };

  // Brings the chosen hour and minute to the middle of their lists. scrollTop, not
  // scrollIntoView: that one also scrolls the page behind the sheet.
  useEffect(() => {
    if (!open) return;
    for (const list of [hourList.current, minuteList.current]) {
      const at = list?.querySelector<HTMLElement>("[data-near]");
      if (list && at)
        list.scrollTop =
          at.offsetTop - list.clientHeight / 2 + at.offsetHeight / 2;
    }
  }, [open]);

  // Up / Down walk one list; Left / Right cross between the two.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    const rows = [...list.querySelectorAll<HTMLElement>("button")];
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const to = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      Home: 0,
      End: rows.length - 1,
    }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      rows[Math.max(0, Math.min(rows.length - 1, to))]?.focus();
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const other = list === hourList.current ? minuteList : hourList;
      other.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    }
  };

  return (
    <>
      <button
        ref={control}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-value={shown}
        className={cn(
          controlVariants({ variant }),
          "flex cursor-pointer items-center justify-between gap-2 text-left tabular-nums",
          variant === "filter" && "inline-flex",
          dropdownFocus,
          !shown && "text-text-secondary",
          className,
        )}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
        {...props}
      >
        <span className="min-w-0 truncate">{shown || placeholder}</span>
        <Clock size={16} aria-hidden className="shrink-0 text-text-secondary" />
      </button>

      <PickerPopover
        open={open}
        anchor={control}
        title={title}
        onClose={close}
        className="md:w-58"
      >
        <div className="flex justify-center gap-2 px-3 pt-3 pb-1 tabular-nums">
          <Column
            ref={hourList}
            name="ชั่วโมง"
            list={hours}
            chosen={current?.h}
            near={9}
            takesFocus
            // The minute stands when the hour changes; a first pick starts on the hour.
            onPick={(h) => onChange(toTime(h, current?.m ?? minutes[0]))}
            onKeyDown={onKeyDown}
          />
          <span
            aria-hidden
            className="mt-6 self-center text-h2 text-text-secondary"
          >
            :
          </span>
          <Column
            ref={minuteList}
            name="นาที"
            list={minutes}
            chosen={current?.m}
            near={minutes[0]}
            onPick={(m) => {
              onChange(toTime(current?.h ?? 9, m));
              done();
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="mt-1 grid grid-cols-3 items-center border-t border-border p-2 text-body-sm">
          {clearable && shown ? (
            <Button
              variant="link"
              size="sm"
              className="justify-self-start text-text-secondary hover:text-text-primary"
              onClick={() => {
                onChange("");
                done();
              }}
            >
              ล้าง
            </Button>
          ) : (
            <span />
          )}
          <span
            aria-live="polite"
            className="text-center text-num-md tabular-nums"
          >
            {shown || "--:--"}
          </span>
          <Button
            variant="link"
            size="sm"
            className="justify-self-end"
            onClick={done}
          >
            เสร็จ
          </Button>
        </div>
      </PickerPopover>
    </>
  );
}
