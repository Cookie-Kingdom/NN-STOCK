/** Date and time maths for `DatePicker` and `TimePicker`. Pure: no React, no clock.
 *  A day is a `YYYY-MM-DD` string and a time an `HH:mm` string, the values the rest of
 *  the app holds, and both are built from the parts of a local `Date`: `toISOString()`
 *  is UTC and gives yesterday before 07:00 in Bangkok. */

export const pad = (n: number) => String(n).padStart(2, "0");

/** `m` is 0-based, as in `Date`. */
export const toISO = (y: number, m: number, d: number) =>
  `${y}-${pad(m + 1)}-${pad(d)}`;

const isoOf = (date: Date) =>
  toISO(date.getFullYear(), date.getMonth(), date.getDate());

/** `{ y, m, d }` (`m` 0-based), or null for anything that is not a real day. */
export function parseISO(value?: string | null) {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!hit) return null;
  const [y, m, d] = [Number(hit[1]), Number(hit[2]) - 1, Number(hit[3])];
  const date = new Date(y, m, d);
  return date.getFullYear() === y &&
    date.getMonth() === m &&
    date.getDate() === d
    ? { y, m, d }
    : null;
}

/** The local `Date` of a day that `parseISO` accepts. */
export function dateOf(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDays(iso: string, days: number) {
  const date = dateOf(iso);
  date.setDate(date.getDate() + days);
  return isoOf(date);
}

export function shiftMonth(y: number, m: number, by: number) {
  const date = new Date(y, m + by, 1);
  return { y: date.getFullYear(), m: date.getMonth() };
}

/** The same day in another month; the 31st lands on that month's last day. */
export function shiftISOMonth(iso: string, by: number) {
  const date = dateOf(iso);
  const to = shiftMonth(date.getFullYear(), date.getMonth(), by);
  const last = new Date(to.y, to.m + 1, 0).getDate();
  return toISO(to.y, to.m, Math.min(date.getDate(), last));
}

export const isOutOfRange = (iso: string, min?: string, max?: string) =>
  Boolean((min && iso < min) || (max && iso > max));

export const clampISO = (iso: string, min?: string, max?: string) =>
  min && iso < min ? min : max && iso > max ? max : iso;

/** The 42 cells (six weeks from a Sunday) of a month view, so the calendar keeps one
 *  height in every month. `m` is 0-based; `weekday` 0 is Sunday. */
export function monthGrid(y: number, m: number) {
  const lead = new Date(y, m, 1).getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(y, m, 1 - lead + index);
    return {
      iso: isoOf(date),
      day: date.getDate(),
      inMonth: date.getMonth() === m,
      weekday: date.getDay(),
    };
  });
}

/** `{ h, m }`, or null for anything that is not a time of day. */
export function parseTime(value?: string | null) {
  const hit = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!hit) return null;
  const [h, m] = [Number(hit[1]), Number(hit[2])];
  return h < 24 && m < 60 ? { h, m } : null;
}

export const toTime = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

/** The minutes on the `step`, plus the `current` one when it is off the step, so a time an
 *  older entry already holds is never silently dropped. */
export function minuteOptions(step: number, current?: number) {
  const list: number[] = [];
  for (let m = 0; m < 60; m += step) list.push(m);
  if (current != null && !list.includes(current)) list.push(current);
  return list.sort((a, b) => a - b);
}
