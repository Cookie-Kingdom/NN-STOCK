import { expect, test } from "vitest";
import {
  clampISO,
  isOutOfRange,
  minuteOptions,
  monthGrid,
  parseISO,
  parseTime,
  shiftDays,
  shiftISOMonth,
  toISO,
  toTime,
} from "@/lib/pickers";

test("parseISO accepts real days only", () => {
  expect(parseISO("2026-10-09")).toEqual({ y: 2026, m: 9, d: 9 });
  expect(parseISO("2026-02-30")).toBeNull();
  expect(parseISO("2026-10-9")).toBeNull();
  expect(parseISO("")).toBeNull();
  expect(parseISO(null)).toBeNull();
});

test("days and months move across month and year ends", () => {
  expect(shiftDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(shiftDays("2026-03-01", -1)).toBe("2026-02-28");
  expect(shiftISOMonth("2026-01-31", 1)).toBe("2026-02-28");
  expect(shiftISOMonth("2026-01-15", -1)).toBe("2025-12-15");
});

test("monthGrid is six weeks from a Sunday", () => {
  const cells = monthGrid(2026, 9); // October 2026 starts on a Thursday
  expect(cells).toHaveLength(42);
  expect(cells[0].iso).toBe("2026-09-27");
  expect(cells[4]).toMatchObject({
    iso: toISO(2026, 9, 1),
    inMonth: true,
    weekday: 4,
  });
  expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
});

test("a day is checked against and clamped to a range", () => {
  expect(isOutOfRange("2026-10-09", "2026-10-10")).toBe(true);
  expect(isOutOfRange("2026-10-09", undefined, "2026-10-08")).toBe(true);
  expect(isOutOfRange("2026-10-09", "2026-10-09", "2026-10-09")).toBe(false);
  expect(clampISO("2026-10-09", "2026-11-01")).toBe("2026-11-01");
  expect(clampISO("2026-10-09", undefined, "2026-10-01")).toBe("2026-10-01");
});

test("a time is parsed and written as HH:mm", () => {
  expect(parseTime("09:05")).toEqual({ h: 9, m: 5 });
  expect(parseTime("24:00")).toBeNull();
  expect(parseTime("")).toBeNull();
  expect(toTime(9, 5)).toBe("09:05");
});

test("minuteOptions keeps a minute that is off the step", () => {
  expect(minuteOptions(30)).toEqual([0, 30]);
  expect(minuteOptions(30, 45)).toEqual([0, 30, 45]);
  expect(minuteOptions(15, 30)).toEqual([0, 15, 30, 45]);
});
