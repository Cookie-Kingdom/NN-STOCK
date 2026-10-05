/** The periods the Overview shows: a month (`YYYY-MM`) or a year (`YYYY`), as a key that is
 *  also the prefix of every date in it. `today` is always a parameter (`YYYY-MM-DD`). */
import { thaiDay } from "./format";

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (month: string) =>
  new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate();

/** The period `by` periods from `key`: a month from a month, a year from a year. */
export const shiftKey = (key: string, by: number) =>
  key.length === 4
    ? String(+key + by)
    : new Date(Date.UTC(+key.slice(0, 4), +key.slice(5) - 1 + by, 1))
        .toISOString()
        .slice(0, 7);

/** "ตุลาคม 2569" for a month, "ปี 2569" for a year. */
export const periodName = (key: string) =>
  key.length === 4
    ? `ปี ${+key + 543}`
    : thaiDay(`${key}-01`, { month: "long", year: "numeric" });

export type Bucket = {
  /** The date prefix of the bar: a day of a month, a month of a year. */
  key: string;
  label: string;
  title: string;
  /** Not reached yet: it has no figure, not a zero. */
  future: boolean;
  /** A day's bar: the same day of the month before, when that month has one. */
  before: string | null;
};

/** What the Overview needs of the period `key`: its names, the like-for-like span before it
 *  (a period still running is set against the same days of the one before, a finished one
 *  against the whole one before) and the bars of its chart. `before` is a pair of text bounds
 *  for `plBetween`. */
export function revenuePeriod(key: string, today: string) {
  const year = key.length === 4;
  const prev = shiftKey(key, -1);
  const end = year ? `${key}-12-31` : `${key}-${pad(daysIn(key))}`;
  const partial = today < end;
  const to = partial ? today : end;
  const name = periodName(key);
  const prevName = periodName(prev);
  const buckets: Bucket[] = [];
  if (year)
    for (let m = 1; m <= 12; m++) {
      const month = `${key}-${pad(m)}`;
      buckets.push({
        key: month,
        label: thaiDay(`${month}-01`, { month: "short" }),
        title: periodName(month),
        future: `${month}-01` > today,
        before: null,
      });
    }
  else
    for (let d = 1; d <= daysIn(key); d++) {
      const date = `${key}-${pad(d)}`;
      buckets.push({
        key: date,
        label: String(d),
        title: thaiDay(date, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        future: date > today,
        before: d <= daysIn(prev) ? `${prev}-${pad(d)}` : null,
      });
    }
  const day = +to.slice(8);
  return {
    name,
    prevName,
    partial,
    /** Days of the period gone by, today included. */
    days:
      (Date.parse(to) - Date.parse(`${key}${year ? "-01-01" : "-01"}`)) /
        86400000 +
      1,
    before: {
      from: prev,
      to: partial ? prev + to.slice(key.length) : `${prev}~`,
    },
    title: year
      ? `รายได้รวม${name}${partial ? " ถึงวันนี้" : ""}`
      : `รายได้รวม ${partial ? `1–${day} ` : ""}${name}`,
    versus: !partial
      ? `จาก${year ? "" : " "}${prevName}`
      : year
        ? `จากช่วงเดียวกันของ${prevName}`
        : `จาก 1–${Math.min(day, daysIn(prev))} ${thaiDay(`${prev}-01`, { month: "short" })}`,
    buckets,
  };
}
