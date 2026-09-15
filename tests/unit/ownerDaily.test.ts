import { expect, test } from "vitest";
import {
  requiredDailyKinds,
  requiredDailyLabels,
  sevenDayRangeStart,
} from "@/components/organisms/owner/ownerDaily";

test("sevenDayRangeStart is six days earlier, across month ends", () => {
  expect(sevenDayRangeStart("2026-09-15")).toBe("2026-09-09");
  expect(sevenDayRangeStart("2026-03-03")).toBe("2026-02-25");
});

test("each branch has its own daily checklist and every item has a label", () => {
  expect(requiredDailyKinds("มีนบุรี")).toContain("riceCarry");
  expect(requiredDailyKinds("ศาลาแดง")).toContain("riceIssue");
  for (const kind of [
    ...requiredDailyKinds("มีนบุรี"),
    ...requiredDailyKinds("ศาลาแดง"),
  ])
    expect(requiredDailyLabels, kind).toHaveProperty(kind);
});
