import { describe, expect, it } from "vitest";
import { broughtForward, type LedgerRow } from "@/lib/store";

const row = (
  date: string,
  direction: "in" | "out",
  paid: number,
  status = "paid",
) => ({ date, direction, paid, status, origin: "manual" }) as LedgerRow;

describe("broughtForward", () => {
  it("nets every row before the month, not the month's own", () => {
    const rows = [
      row("2026-09-15", "in", 1000),
      row("2026-10-31", "out", 300),
      row("2026-10-20", "out", 50, "cancelled"),
      row("2026-10-21", "in", 70, "pending"),
      row("2026-11-01", "in", 999),
    ];
    expect(broughtForward(rows, "2026-11")).toBe(700);
    expect(broughtForward(rows, "2026-10")).toBe(1000);
    expect(broughtForward(rows, "2026-09")).toBe(0);
  });
});
