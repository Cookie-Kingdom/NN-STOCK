import { expect, test } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useBranchAlerts as branchAlerts } from "@/components/organisms/branch/useBranchAlerts";
import { branchNav } from "@/lib/nav";
import { materials, seed, type Database } from "@/lib/store";
import { day, ready, setup } from "./fixtures";

const titles = (db: Database, branch: string, date = day) =>
  branchAlerts(db, branch, date).notifications.map((item) => item.title);

/** Every day starts uncounted, so this line rides along until `materials` is saved. */
const notCounted = `ยังไม่ตรวจนับสต๊อกวัสดุวันที่ ${day}`;
const notJotted = (count: number) =>
  `ยังไม่ได้จด ${count} รายการของวันที่ ${day}`;

test("an empty day asks to be closed and to count the materials", () => {
  expect(titles(structuredClone(seed), "ศาลาแดง")).toEqual([
    notJotted(3),
    notCounted,
  ]);
});

test("meat in central stock rings no branch's bell: branches record receives themselves (BR-07)", () => {
  const s = ready();
  for (const branch of ["ศาลาแดง", "มีนบุรี"]) {
    expect(titles(s.db, branch)).toEqual([notJotted(3), notCounted]);
    expect(branchAlerts(s.db, branch, day).badges.day).toBe(1);
  }
});

test("nothing waits on the Owner for material: รับวัสดุ has no alert and no badge (MAT-01)", () => {
  const s = setup();
  s.run("owner", "materialReceive", {
    purchaseDate: day,
    material: materials[0],
    quantity: "200",
    unitPrice: "3",
    supplier: "ร้านวัสดุ",
  });
  const { badges, notifications } = branchAlerts(s.db, "ศาลาแดง", day);
  expect(badges).not.toHaveProperty("material-receive");
  expect(notifications.map((item) => item.tab)).not.toContain(
    "material-receive",
  );
});

test("ตรวจนับสต๊อกวัสดุ waits until the day's one materials entry is saved", () => {
  const s = setup();
  expect(branchAlerts(s.db, "ศาลาแดง", day).badges["material-count"]).toBe(
    materials.length,
  );
  expect(titles(s.db, "ศาลาแดง")).toContain(notCounted);

  s.run(
    "branch",
    "materials",
    Object.fromEntries(materials.map((_, index) => [`material${index}`, "10"])),
  );
  expect(branchAlerts(s.db, "ศาลาแดง", day).badges["material-count"]).toBe(0);
  expect(titles(s.db, "ศาลาแดง")).not.toContain(notCounted);
  // One branch's count is not the other's: มีนบุรี still owes its own.
  expect(branchAlerts(s.db, "มีนบุรี", day).badges["material-count"]).toBe(
    materials.length,
  );
});

test("the day's own work follows the daily workflow, step by step", () => {
  const s = ready();
  s.run("branch", "receive", { kg: "20" });
  expect(titles(s.db, "ศาลาแดง")).toEqual([
    `ยังไม่ได้จดแบ่งละลายเนื้อวันที่ ${day}`,
    notJotted(3),
    notCounted,
  ]);
  // Nothing of this reaches มีนบุรี: no receive, no thaw, no sale of its own.
  expect(titles(s.db, "มีนบุรี")).toEqual([notJotted(3), notCounted]);

  s.run("branch", "thaw", { kg: "20", bags: "2" });
  expect(titles(s.db, "ศาลาแดง")).toEqual([
    `ยังไม่ได้จดยอดขายวันที่ ${day}`,
    notJotted(3),
    notCounted,
  ]);

  s.run("branch", "sale", {
    boxes: "0",
    chiliAddons: "0",
    soldKg: "19",
    wasteKg: "0",
    riceWasteKg: "0",
    expense: "0",
    lineMan: "60000",
  });
  expect(titles(s.db, "ศาลาแดง")).toEqual([notJotted(2), notCounted]);

  s.run(
    "branch",
    "materials",
    Object.fromEntries(materials.map((_, index) => [`material${index}`, "10"])),
  );
  s.run("branch", "riceCarry", { leftoverKg: "0" });
  expect(titles(s.db, "ศาลาแดง")).toEqual([
    `จดครบแล้ว · ยังไม่ได้ปิดวันที่ ${day}`,
  ]);
  expect(branchAlerts(s.db, "ศาลาแดง", day).badges["material-count"]).toBe(0);

  s.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
  expect(titles(s.db, "ศาลาแดง")).toEqual([]);
  expect(branchAlerts(s.db, "ศาลาแดง", day).badges.day).toBe(0);
});

test("every branch alert points at a tab a branch actually has", () => {
  const s = ready();
  const tabs = branchAlerts(s.db, "ศาลาแดง", day).notifications.map(
    (item) => item.tab,
  );
  const branchTabs = branchNav.flatMap((group) =>
    group.items.map((item) => item.id),
  );
  expect(branchTabs).toEqual([
    "day",
    "material-receive",
    "material-count",
    "rice",
    "stock",
    "meat-summary",
    "branch-summary",
    "history",
  ]);
  expect(tabs.length).toBeGreaterThan(0);
  for (const tab of tabs) expect(branchTabs).toContain(tab);
  // A badge can only be hung on a tab the sidebar renders.
  for (const tab of Object.keys(branchAlerts(s.db, "ศาลาแดง", day).badges))
    expect(branchTabs).toContain(tab);
});
