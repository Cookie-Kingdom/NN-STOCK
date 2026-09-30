import { expect, test } from "vitest";
import { fmt } from "@/lib/format";
import { allocationOutstanding, pendingReceiveKg } from "@/lib/store";
import { legacyAllocate, legacyReceive, ready } from "./fixtures";

test("allocation kg with extra decimals: the shown 0.01 figure is accepted and clears it", () => {
  const s = ready();
  const id = s.db.lots.at(-1)!.id;
  // Old data: allocations are retired (BR-01), their math still counts.
  const first = legacyAllocate(s, { branch: "ศาลาแดง", kg: "8.326667" });
  expect(fmt(allocationOutstanding(s.db, first))).toBe("8.33");
  expect(allocationOutstanding(s.db, first)).toBe(8.33);
  legacyReceive(s, "8.33", first.id);
  expect(allocationOutstanding(s.db, first)).toBe(0);

  const second = legacyAllocate(s, { branch: "ศาลาแดง", kg: "5.006667" });
  expect(allocationOutstanding(s.db, second)).toBe(5.01);
  legacyReceive(s, "5", second.id, { reason: "ตาชั่ง" });
  // 0.01 short: still pending until the rest arrives.
  expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0.01);
  legacyReceive(s, "0.01", second.id);
  expect(pendingReceiveKg(s.db, id, "ศาลาแดง")).toBe(0);
});
