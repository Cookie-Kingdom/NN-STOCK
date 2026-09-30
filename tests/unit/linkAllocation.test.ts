import { expect, test } from "vitest";
import {
  allocationOutstanding,
  centralStock,
  pendingReceiveKg,
} from "@/lib/store";
import { last, legacyAllocate, legacyReceive, ready } from "./fixtures";

const branch = "ศาลาแดง";

/** 35 kg central on the newest batch, `allocated` kg of it allocated to ศาลาแดง (old data,
 *  from before allocation was retired), then a
 *  ไม่ระบุ Lot receive of `kg` linked to the batch (DM-08). */
function linked(kg: string, allocated?: string) {
  const s = ready();
  const batch = s.db.lots.at(-1)!.id;
  const allocation = allocated
    ? legacyAllocate(s, { branch, kg: allocated })
    : undefined;
  s.run("branch", "receive", { kg }, "");
  s.run("branch", "link", { targetId: last(s).id, lotId: batch }, "");
  return { s, batch, allocation };
}

test("DM-08 a linked receive fills the branch's outstanding allocation, not central twice", () => {
  const { s, batch, allocation } = linked("10", "10");
  expect(allocationOutstanding(s.db, allocation!)).toBe(0);
  expect(pendingReceiveKg(s.db, batch, branch)).toBe(0);
  expect(centralStock(s.db, batch)).toBe(25);
});

test("DM-08 a linked receive smaller than the allocation leaves the rest outstanding", () => {
  const { s, batch, allocation } = linked("4", "10");
  expect(allocationOutstanding(s.db, allocation!)).toBe(6);
  expect(centralStock(s.db, batch)).toBe(25);
  // An old receive of the rest against the allocation clears it.
  legacyReceive(s, "6", allocation!.id);
  expect(allocationOutstanding(s.db, allocation!)).toBe(0);
  expect(centralStock(s.db, batch)).toBe(25);
});

test("DM-08 kg beyond the allocation counts as a straight receive", () => {
  const { s, batch, allocation } = linked("15", "10");
  expect(allocationOutstanding(s.db, allocation!)).toBe(0);
  expect(centralStock(s.db, batch)).toBe(20);
});

test("DM-08 with no allocation the linked receive is a straight receive (RET-04)", () => {
  const { s, batch } = linked("10");
  expect(centralStock(s.db, batch)).toBe(25);
});
