/** The periods the Overview shows: a month (`YYYY-MM`) or a year (`YYYY`), as a key that is
 *  also the prefix of every date in it. `today` is always a parameter (`YYYY-MM-DD`). */
import { dateLabel, thaiDay } from "./format";
import { shiftDays } from "./pickers";

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

/** What the Overview needs of the period `key`: its names, the like-for-like span before it
 *  (a period still running is set against the same days of the one before, a finished one
 *  against the whole one before). `before` is a pair of text bounds for `plBetween`. */
export function revenuePeriod(key: string, today: string) {
  const year = key.length === 4;
  const prev = shiftKey(key, -1);
  const start = `${key}${year ? "-01-01" : "-01"}`;
  const end = year ? `${key}-12-31` : `${key}-${pad(daysIn(key))}`;
  const partial = today < end;
  const to = partial ? today : end;
  const name = periodName(key);
  const prevName = periodName(prev);
  const day = +to.slice(8);
  /** The period as far as it has run: "1–24 ตุลาคม 2569", "ปี 2569 ถึงวันนี้". */
  const range = year
    ? `${name}${partial ? " ถึงวันนี้" : ""}`
    : `${partial ? `1–${day} ` : ""}${name}`;
  return {
    name,
    range,
    /** The period's first and last days. */
    start,
    end,
    prevName,
    partial,
    /** Days of the period gone by, today included. */
    days: (Date.parse(to) - Date.parse(start)) / 86400000 + 1,
    before: {
      from: prev,
      to: partial ? prev + to.slice(key.length) : `${prev}~`,
    },
    title: `รายได้รวม${year ? "" : " "}${range}`,
    versus: !partial
      ? `จาก${year ? "" : " "}${prevName}`
      : year
        ? `จากช่วงเดียวกันของ${prevName}`
        : `จาก 1–${Math.min(day, daysIn(prev))} ${thaiDay(`${prev}-01`, { month: "short" })}`,
  };
}

/** The bars of the days `from`..`to` (`YYYY-MM-DD`, both counted): a bar a day up to 62 days,
 *  past that a bar a month, its ends cut to the span. Each bar's `from` / `to` bound its rows;
 *  a day's `before` is the same day of the month before, when that month has one. */
export function rangeBuckets(from: string, to: string) {
  const byDay = (Date.parse(to) - Date.parse(from)) / 86400000 < 62;
  const twoYears = from.slice(0, 4) !== to.slice(0, 4);
  const bars: {
    from: string;
    to: string;
    label: string;
    title: string;
    before: string | null;
  }[] = [];
  if (byDay)
    for (let d = from; d <= to; d = shiftDays(d, 1)) {
      const prev = shiftKey(d.slice(0, 7), -1);
      bars.push({
        from: d,
        to: d,
        label: thaiDay(d),
        title: dateLabel(d),
        before: +d.slice(8) <= daysIn(prev) ? prev + d.slice(7) : null,
      });
    }
  else
    for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = shiftKey(m, 1)) {
      const first = `${m}-01`;
      const last = `${m}-${pad(daysIn(m))}`;
      bars.push({
        from: first < from ? from : first,
        to: last > to ? to : last,
        label: thaiDay(first, {
          month: "short",
          ...(twoYears && { year: "2-digit" }),
        }),
        title: periodName(m),
        before: null,
      });
    }
  return { byDay, bars };
}
