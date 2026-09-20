import { describe, expect, it } from "vitest";
import {
  compareCells,
  datedColumn,
} from "@/components/organisms/shared/DataTable";

const sorted = (values: string[]) => [...values].sort(compareCells);

describe("compareCells", () => {
  it("sorts numbers by value, not by text", () => {
    expect(sorted(["10.00 กก.", "9.00 กก.", "100.00 กก."])).toEqual([
      "9.00 กก.",
      "10.00 กก.",
      "100.00 กก.",
    ]);
    expect(sorted(["฿1,200.00", "฿900.00"])).toEqual(["฿900.00", "฿1,200.00"]);
  });

  it("sorts ISO dates chronologically", () => {
    expect(sorted(["2026-09-20", "2026-01-05", "2025-12-31"])).toEqual([
      "2025-12-31",
      "2026-01-05",
      "2026-09-20",
    ]);
  });

  it("falls back to text for ids and labels", () => {
    expect(sorted(["PO-2026-02", "PO-2026-01"])).toEqual([
      "PO-2026-01",
      "PO-2026-02",
    ]);
    expect(compareCells("รอยืนยัน", "รอยืนยัน")).toBe(0);
  });
});

describe("compareCells ids", () => {
  it("keeps lot and PO ids in text order", () => {
    expect(sorted(["PO-2026-02", "PO-2025-09"])).toEqual([
      "PO-2025-09",
      "PO-2026-02",
    ]);
    expect(sorted(["20260102-01", "20260101-02"])).toEqual([
      "20260101-02",
      "20260102-01",
    ]);
  });
});

describe("datedColumn", () => {
  it("finds the column that carries dates", () => {
    expect(datedColumn([["PO-2026-0001", "2026-01-05", "9.00 กก."]])).toBe(1);
    expect(datedColumn([["F260105-001", "รอรับ"]])).toBe(0);
  });

  it("returns -1 when no column holds a date", () => {
    expect(datedColumn([["ยอดขาย", "1,200.00", "บาท"]])).toBe(-1);
    expect(datedColumn([])).toBe(-1);
  });
});
