import { expect, test } from "vitest";
import {
  requiredDailyKinds,
  requiredDailyLabels,
  sevenDayRangeStart,
} from "@/components/organisms/owner/ownerDaily";
import { seed } from "@/lib/store";

test("sevenDayRangeStart is six days earlier, across month ends", () => {
  expect(sevenDayRangeStart("2026-09-15")).toBe("2026-09-09");
  expect(sevenDayRangeStart("2026-03-03")).toBe("2026-02-25");
});

test("the daily checklist follows what the branch did, not which branch it is", () => {
  const db = structuredClone(seed);
  for (const name of ["มีนบุรี", "ศาลาแดง"])
    expect(requiredDailyKinds(db, name, "2026-09-15")).toEqual([
      "riceCarry",
      "materials",
      "sale",
      "closeDay",
    ]);
  db.entries.push({
    id: "issue",
    kind: "riceIssue",
    role: "branch",
    lotId: "",
    branch: "มีนบุรี",
    date: "2026-09-15",
    at: "2026-09-15T08:00:00.000Z",
    values: { rawRiceIssuedKg: "3" },
  });
  expect(requiredDailyKinds(db, "มีนบุรี", "2026-09-15")).toContain("rice");
  expect(requiredDailyKinds(db, "ศาลาแดง", "2026-09-15")).not.toContain("rice");
  for (const kind of requiredDailyKinds(db, "มีนบุรี", "2026-09-15"))
    expect(requiredDailyLabels, kind).toHaveProperty(kind);
});
