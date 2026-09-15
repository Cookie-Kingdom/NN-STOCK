import { expect, test, vi } from "vitest";
import { fmt, today } from "@/lib/format";
import { cn } from "@/lib/utils";

test("fmt shows two decimals with thousands grouping", () => {
  expect(fmt(1234.5)).toBe("1,234.50");
  expect(fmt(0)).toBe("0.00");
  expect(fmt(-12)).toBe("-12.00");
});

test("today is the date in Bangkok, not UTC", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T18:30:00Z"));
  expect(today()).toBe("2026-09-15");
  vi.useRealTimers();
});

test("cn merges conflicting classes but keeps custom text sizes next to colours", () => {
  expect(cn("text-body", "text-accent")).toBe("text-body text-accent");
  expect(cn("text-h1", "text-h2")).toBe("text-h2");
  expect(cn("p-2", false, "p-4")).toBe("p-4");
});
