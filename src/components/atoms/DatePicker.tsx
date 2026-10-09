"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import {
  controlVariants,
  type ControlVariantProps,
} from "@/components/atoms/Input";
import { PickerPopover } from "@/components/atoms/PickerPopover";
import { dropdownFocus } from "@/components/atoms/Select";
import { dateLabel, today as todayInBangkok } from "@/lib/format";
import {
  clampISO,
  dateOf,
  isOutOfRange,
  monthGrid,
  parseISO,
  shiftDays,
  shiftISOMonth,
  shiftMonth,
  toISO,
} from "@/lib/pickers";
import { cn } from "@/lib/utils";

const thai = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("th-TH", options);
const fmt = {
  title: thai({ year: "numeric", month: "long" }),
  year: thai({ year: "numeric" }),
  month: thai({ month: "short" }),
  day: thai({ dateStyle: "full" }),
};
// Written out: the browsers disagree on a short Thai weekday ("อา." or "อาทิตย์"), and
// seven of them must fit a 320px sheet.
const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/**
 * The app's date field, drawn instead of left to the browser's `<input type="date">`:
 * that one shows the device's date format and calendar, not the app's, and looks
 * different on every OS. This one reads as every other date in the app ("9 ต.ค. 2569")
 * and opens the same calendar everywhere: under the field from md up, a sheet below md.
 *
 * `value` is the `YYYY-MM-DD` string a native date input holds, `""` for none, and
 * `onChange` gets the next one. Shares Input's variants, so it lines up with a text field
 * or a `Select` on the same row.
 *
 * A press on a day picks it and closes. The month's name opens the twelve months, with
 * the arrows stepping a year, for a day far from today. `min` / `max` (`YYYY-MM-DD`) turn
 * off the days outside them. `clearable` adds 「ล้าง」, which gives `""`.
 *
 * Keyboard: arrows move a day or a week, PageUp / PageDown a month, Home / End to the
 * ends of the week; Enter picks; Escape closes.
 */
export function DatePicker({
  variant,
  className,
  value,
  onChange,
  min,
  max,
  placeholder = "เลือกวันที่",
  title = "เลือกวันที่",
  clearable = false,
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "value" | "onChange" | "children"> &
  ControlVariantProps & {
    value: string;
    onChange: (value: string) => void;
    min?: string;
    max?: string;
    placeholder?: string;
    /** Names the calendar and heads the sheet below md: the field's own label. */
    title?: string;
    clearable?: boolean;
  }) {
  const control = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const selected = parseISO(value) ? value : "";

  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState(false);
  /** The day the arrow keys are on. */
  const [active, setActive] = useState("");
  const [view, setView] = useState({ y: 0, m: 0 });

  const close = () => setOpen(false);
  const show = () => {
    const start = clampISO(selected || todayInBangkok(), min, max);
    const at = dateOf(start);
    setActive(start);
    setView({ y: at.getFullYear(), m: at.getMonth() });
    setMonths(false);
    setOpen(true);
  };
  const choose = (iso: string) => {
    if (isOutOfRange(iso, min, max)) return;
    if (iso !== selected) onChange(iso);
    close();
    control.current?.focus();
  };
  const step = (by: number) =>
    setView(
      months ? { ...view, y: view.y + by } : shiftMonth(view.y, view.m, by),
    );

  const onGridKeyDown = (event: KeyboardEvent) => {
    const weekday = dateOf(active).getDay();
    const to = {
      ArrowLeft: () => shiftDays(active, -1),
      ArrowRight: () => shiftDays(active, 1),
      ArrowUp: () => shiftDays(active, -7),
      ArrowDown: () => shiftDays(active, 7),
      PageUp: () => shiftISOMonth(active, -1),
      PageDown: () => shiftISOMonth(active, 1),
      Home: () => shiftDays(active, -weekday),
      End: () => shiftDays(active, 6 - weekday),
    }[event.key];
    if (!to) return;
    event.preventDefault();
    const next = clampISO(to(), min, max);
    const at = dateOf(next);
    moveFocus.current = true;
    setActive(next);
    setView({ y: at.getFullYear(), m: at.getMonth() });
  };

  // After a key only: a press with the pointer must not pull focus around.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    grid.current
      ?.querySelector<HTMLElement>('[tabindex="0"]')
      ?.focus({ preventScroll: true });
  }, [active]);

  const today = open ? todayInBangkok() : "";
  const cells = open && !months ? monthGrid(view.y, view.m) : [];
  // The one day Tab lands on: the active day when its month is shown, else the 1st.
  const tabStop = cells.some((cell) => cell.inMonth && cell.iso === active)
    ? active
    : toISO(view.y, view.m, 1);
  const chosenAt = selected ? dateOf(selected) : null;
  const todayAt = today ? dateOf(today) : null;

  return (
    <>
      <button
        ref={control}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-value={selected}
        className={cn(
          controlVariants({ variant }),
          "flex cursor-pointer items-center justify-between gap-2 text-left tabular-nums",
          variant === "filter" && "inline-flex",
          dropdownFocus,
          !selected && "text-text-secondary",
          className,
        )}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
        {...props}
      >
        <span className="min-w-0 truncate">
          {selected ? dateLabel(selected) : placeholder}
        </span>
        <CalendarDays
          size={16}
          aria-hidden
          className="shrink-0 text-text-secondary"
        />
      </button>

      <PickerPopover
        open={open}
        anchor={control}
        title={title}
        onClose={close}
        className="md:w-76"
      >
        <div className="flex items-center justify-between gap-1 px-2 pt-2">
          <IconButton
            label={months ? "ปีก่อนหน้า" : "เดือนก่อนหน้า"}
            icon={<ChevronLeft size={18} />}
            onClick={() => step(-1)}
          />
          <button
            type="button"
            aria-expanded={months}
            aria-label={`${fmt.title.format(new Date(view.y, view.m, 1))} เลือกเดือน`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-body font-semibold transition-colors duration-(--motion-fast) ease-(--ease-standard) hover:bg-bg"
            onClick={() => setMonths(!months)}
          >
            <span aria-live="polite">
              {months
                ? fmt.year.format(new Date(view.y, 0, 1))
                : fmt.title.format(new Date(view.y, view.m, 1))}
            </span>
            <ChevronDown
              size={16}
              aria-hidden
              className={cn(
                "text-text-secondary transition-transform duration-(--motion-base) ease-(--ease-enter)",
                months && "rotate-180",
              )}
            />
          </button>
          <IconButton
            label={months ? "ปีถัดไป" : "เดือนถัดไป"}
            icon={<ChevronRight size={18} />}
            onClick={() => step(1)}
          />
        </div>

        {months ? (
          // As tall as the weekday row and the six weeks, so the panel never jumps.
          <div className="grid h-67 animate-fade-in grid-cols-3 gap-2 px-3 pt-2 pb-1 pointer-coarse:h-73">
            {Array.from({ length: 12 }, (_, m) => {
              const chosen =
                chosenAt?.getFullYear() === view.y && chosenAt.getMonth() === m;
              const current =
                todayAt?.getFullYear() === view.y && todayAt.getMonth() === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={chosen}
                  aria-current={current ? "date" : undefined}
                  className={cn(
                    "rounded-md text-body-sm font-medium transition-colors duration-(--motion-fast) ease-(--ease-standard) max-md:text-body",
                    chosen
                      ? "bg-accent font-semibold text-accent-fg"
                      : "hover:bg-accent-subtle",
                    current && !chosen && "inset-ring inset-ring-accent",
                  )}
                  onClick={() => {
                    setView({ ...view, m });
                    setMonths(false);
                  }}
                >
                  {fmt.month.format(new Date(view.y, m, 1))}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div
              aria-hidden
              className="mt-1 grid grid-cols-7 px-3 text-center text-caption leading-7 text-text-secondary"
            >
              {weekdays.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
            {/* The grid owns the arrow keys; its days are the focus targets. */}
            <div
              ref={grid}
              key={`${view.y}-${view.m}`}
              className="grid animate-fade-in grid-cols-7 px-3 pb-1 tabular-nums"
              onKeyDown={onGridKeyDown}
            >
              {cells.map((cell) => {
                const chosen = cell.iso === selected;
                return (
                  // The button is the touch target; the span inside is the painted day.
                  <button
                    key={cell.iso}
                    type="button"
                    data-date={cell.iso}
                    data-picker-focus={cell.iso === tabStop ? "" : undefined}
                    tabIndex={cell.iso === tabStop ? 0 : -1}
                    disabled={isOutOfRange(cell.iso, min, max)}
                    aria-label={fmt.day.format(dateOf(cell.iso))}
                    aria-pressed={chosen}
                    aria-current={cell.iso === today ? "date" : undefined}
                    className="group/day grid h-10 place-items-center rounded-md text-body-sm focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 max-md:text-body pointer-coarse:h-11"
                    onClick={() => choose(cell.iso)}
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-md transition-colors duration-(--motion-fast) ease-(--ease-standard) pointer-coarse:size-10",
                        cell.inMonth ? "font-medium" : "text-text-secondary",
                        chosen
                          ? "bg-accent font-semibold text-accent-fg"
                          : "group-enabled/day:group-hover/day:bg-accent-subtle",
                        cell.iso === today &&
                          !chosen &&
                          "inset-ring inset-ring-accent",
                      )}
                    >
                      {cell.day}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border p-2 text-body-sm">
          {clearable && selected ? (
            <Button
              variant="link"
              size="sm"
              className="text-text-secondary hover:text-text-primary"
              onClick={() => {
                onChange("");
                close();
                control.current?.focus();
              }}
            >
              ล้าง
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="link"
            size="sm"
            disabled={isOutOfRange(today, min, max)}
            onClick={() => choose(today)}
          >
            วันนี้
          </Button>
        </div>
      </PickerPopover>
    </>
  );
}
