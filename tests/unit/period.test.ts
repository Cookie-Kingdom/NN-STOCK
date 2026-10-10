import { describe, expect, it } from "vitest";
import { revenuePeriod, shiftKey } from "@/lib/period";

describe("revenuePeriod", () => {
  it("a month still running is set against the same days of the month before", () => {
    const p = revenuePeriod("2026-10", "2026-10-24");
    expect(p).toMatchObject({
      partial: true,
      days: 24,
      before: { from: "2026-09", to: "2026-09-24" },
    });
    expect(p.buckets).toHaveLength(31);
    expect(p.buckets[23]).toMatchObject({
      future: false,
      before: "2026-09-24",
    });
    expect(p.buckets[24].future).toBe(true);
    // September has no 31st.
    expect(p.buckets[30].before).toBeNull();
  });

  it("a finished month is set against the whole month before", () => {
    const p = revenuePeriod("2026-02", "2026-10-24");
    expect(p).toMatchObject({
      partial: false,
      days: 28,
      before: { from: "2026-01", to: "2026-01~" },
    });
    expect("2026-01-31" <= p.before.to).toBe(true);
  });

  it("a year has a bar per month, and is set against the same days of the year before", () => {
    const p = revenuePeriod("2026", "2026-10-24");
    expect(p.before).toEqual({ from: "2025", to: "2025-10-24" });
    expect(p.days).toBe(297);
    expect(p.buckets.map((b) => b.future)).toEqual([
      ...Array(10).fill(false),
      true,
      true,
    ]);
  });

  it("names the span on its own, and the whole revenue of it", () => {
    for (const [key, range, title] of [
      ["2026-10", "1–24 ตุลาคม 2569", "รายได้รวม 1–24 ตุลาคม 2569"],
      ["2026-02", "กุมภาพันธ์ 2569", "รายได้รวม กุมภาพันธ์ 2569"],
      ["2026", "ปี 2569 ถึงวันนี้", "รายได้รวมปี 2569 ถึงวันนี้"],
      ["2025", "ปี 2568", "รายได้รวมปี 2568"],
    ])
      expect(revenuePeriod(key, "2026-10-24")).toMatchObject({ range, title });
  });

  it("steps over a year's end", () => {
    expect(shiftKey("2026-01", -1)).toBe("2025-12");
    expect(shiftKey("2026", 1)).toBe("2027");
  });
});
