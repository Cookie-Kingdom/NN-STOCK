import { expect, test } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useBranchAlerts as branchAlerts } from "@/components/organisms/branch/useBranchAlerts";
import { branchNav } from "@/lib/nav";
import { materials, mutate, seed, type Database } from "@/lib/store";
import { day, last, ready, setup } from "./fixtures";

const titles = (db: Database, branch: string, date = day) =>
  branchAlerts(db, branch, date).notifications.map((item) => item.title);

/** A lot at central stock with `kg` allocated to `branch`. */
function allocated(branch: string, kg: string) {
  const s = ready();
  s.run("owner", "allocate", { branch, kg, deliveryDate: day });
  return s;
}

/** Every day starts uncounted, so this line rides along until `materials` is saved. */
const notCounted = `ยังไม่ตรวจนับสต๊อกวัสดุวันที่ ${day}`;

test("an empty day asks to be closed and to count the materials", () => {
  expect(titles(structuredClone(seed), "ศาลาแดง")).toEqual([
    `ยังขาด 3 รายการก่อนปิดวันที่ ${day}`,
    notCounted,
  ]);
});

test("an allocation waits at its own branch and nowhere else", () => {
  const s = allocated("ศาลาแดง", "17.5");
  expect(branchAlerts(s.db, "ศาลาแดง", day).notifications[0]).toEqual({
    title: "รับเนื้อเข้าสาขา 1 Lot",
    detail: "Owner จัดสรรมา 17.50 กก. ยังไม่ได้รับเข้าสาขาศาลาแดง",
    tab: "day",
  });
  // มีนบุรี was not allocated anything: its bell must not mention the other branch's Lot.
  expect(titles(s.db, "มีนบุรี")).toEqual([
    `ยังขาด 3 รายการก่อนปิดวันที่ ${day}`,
    notCounted,
  ]);
  expect(branchAlerts(s.db, "มีนบุรี", day).badges.day).toBe(1);
});

test("material sent to one branch is not the other branch's job", () => {
  const s = setup();
  s.run("owner", "materialReceive", {
    purchaseDate: day,
    material: materials[0],
    quantity: "200",
    unitPrice: "3",
    supplier: "ร้านวัสดุ",
  });
  s.run("owner", "materialTransfer", {
    material: materials[0],
    branch: "ศาลาแดง",
    quantity: "60",
    receiver: "ผู้ดูแลสาขา",
  });
  expect(
    branchAlerts(s.db, "ศาลาแดง", day).notifications.find(
      (item) => item.title === "วัสดุรอยืนยันรับ 1 รายการ",
    ),
  ).toEqual({
    title: "วัสดุรอยืนยันรับ 1 รายการ",
    detail: "ตรวจจำนวนที่มาถึงจริงแล้วกดยืนยันรับ",
    tab: "material-receive",
  });
  // The line belongs to its own tab now — it must not inflate the กรอกรายวัน pill.
  const salaBadges = branchAlerts(s.db, "ศาลาแดง", day).badges;
  expect(salaBadges["material-receive"]).toBe(1);
  expect(salaBadges.day).toBe(branchAlerts(s.db, "มีนบุรี", day).badges.day);

  expect(titles(s.db, "มีนบุรี")).not.toContain("วัสดุรอยืนยันรับ 1 รายการ");
  expect(branchAlerts(s.db, "มีนบุรี", day).badges["material-receive"]).toBe(0);
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
  const s = allocated("ศาลาแดง", "20");
  const allocation = last(s);
  s.run("branch", "receive", { kg: "20", allocation: allocation.id });
  expect(titles(s.db, "ศาลาแดง")).toEqual([
    `ยังไม่แบ่งละลายเนื้อวันที่ ${day}`,
    `ยังขาด 3 รายการก่อนปิดวันที่ ${day}`,
    notCounted,
  ]);
  // Nothing of this reaches มีนบุรี: no receive, no thaw, no sale of its own.
  expect(titles(s.db, "มีนบุรี")).toEqual([
    `ยังขาด 3 รายการก่อนปิดวันที่ ${day}`,
    notCounted,
  ]);

  s.run("branch", "thaw", { kg: "20", bags: "2" });
  expect(titles(s.db, "ศาลาแดง")).toEqual([
    `ยังไม่บันทึกยอดขายวันที่ ${day}`,
    `ยังขาด 3 รายการก่อนปิดวันที่ ${day}`,
    notCounted,
  ]);

  s.run("branch", "sale", {
    boxes: "0",
    addons: "190",
    chiliAddons: "0",
    soldKg: "19",
    wasteKg: "0",
    riceWasteKg: "0",
    expense: "0",
    lineMan: "60000",
  });
  expect(titles(s.db, "ศาลาแดง")).toEqual([
    `ยังขาด 2 รายการก่อนปิดวันที่ ${day}`,
    notCounted,
  ]);

  s.run(
    "branch",
    "materials",
    Object.fromEntries(materials.map((_, index) => [`material${index}`, "10"])),
  );
  s.run("branch", "riceCarry", {
    leftoverKg: "0",
    reheat: "เก็บไว้อุ่นวันถัดไป",
  });
  expect(titles(s.db, "ศาลาแดง")).toEqual([`พร้อมปิดวันที่ ${day}`]);
  expect(branchAlerts(s.db, "ศาลาแดง", day).badges["material-count"]).toBe(0);

  s.run("branch", "closeDay", { confirm: "ผู้ดูแล" });
  expect(titles(s.db, "ศาลาแดง")).toEqual([]);
  expect(branchAlerts(s.db, "ศาลาแดง", day).badges.day).toBe(0);
});

test("an edit request is only ever shown to the branch that made it", () => {
  const s = allocated("ศาลาแดง", "20");
  s.run("branch", "receive", { kg: "20", allocation: last(s).id });
  const receipt = last(s);
  const asked = mutate(
    s.db,
    "branch",
    "editRequest",
    {
      targetId: receipt.id,
      values: JSON.stringify({ kg: "19" }),
      reason: "ชั่งได้ไม่ครบ",
    },
    "",
    day,
    "ศาลาแดง",
  );
  expect(
    titles(asked, "ศาลาแดง").some((title) => title.startsWith("คำขอแก้ไข")),
  ).toBe(true);
  expect(branchAlerts(asked, "ศาลาแดง", day).badges.history).toBe(1);
  expect(
    titles(asked, "มีนบุรี").some((title) => title.startsWith("คำขอแก้ไข")),
  ).toBe(false);
  expect(branchAlerts(asked, "มีนบุรี", day).badges.history).toBe(0);
});

test("every branch alert points at a tab a branch actually has", () => {
  const s = allocated("ศาลาแดง", "20");
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
