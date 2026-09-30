"use client";

import type { Notification } from "@/components/organisms/workspace/NotificationPopover";
import { editRequestAlerts } from "@/components/organisms/workspace/editRequestAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import {
  balance,
  closeDayChecklist,
  type Database,
  entries,
  isClosed,
  materials,
  pendingReceiveKg,
  visibleLots,
} from "@/lib/store";

/** What a branch is shown before the first payload lands. Until then the UI is still on
 * the seed, and a signal read off it is an alarm nobody can act on. */
export const noBranchAlerts = {
  notifications: [] as Notification[],
  dayTasks: 0,
  badges: {} as Partial<Record<Tab, number>>,
};

/** Material the Owner sent this branch that nobody has confirmed as arrived — the same
 *  list `MaterialReceiptConfirmation` shows, read the same way. */
function pendingMaterialTransfers(db: Database, branch: string) {
  const confirms = entries(db, "materialConfirm", undefined, branch);
  return entries(db, "materialTransfer", undefined, branch).filter(
    (transfer) =>
      transfer.values.requiresConfirm &&
      !confirms.some((entry) => entry.values.transferId === transfer.id),
  );
}

/** Every "this branch has to do something" signal for `date`.
 *
 *  A branch account reads the whole database (`visibleDatabase` only strips sale money for the Account Manager),
 *  so every read here is scoped by `branch`: the allocations, the balances, the daily
 *  entries and the close checklist all take it, and a lot only counts once it was
 *  allocated to this branch or holds this branch's own entries (BR-07, `ws.lots`). The
 *  "ไม่ระบุ Lot" bucket (`lotId ""`) counts as one more lot for thawing and selling.
 *  There is no stage to wait on (DASH-02): each line is what this branch's own balances
 *  still owe, never a gate — "รับเนื้อ" stays open with or without an allocation. `editRequestAlerts` filters through `visibleEntries`, which
 *  keeps a branch's requests to its own branch. Nothing about another branch can reach
 *  this bell.
 *
 *  The day lines follow `BranchDailyWorkflow`'s `["receive","thaw","sale","close"]` and
 *  read the same helpers, so the bell and that table can never disagree. Material work
 *  moved off `day` onto its own tabs, so those two lines point at `material-receive` and
 *  `material-count` and are counted on those badges, never on `day`. */
export function useBranchAlerts(db: Database, branch: string, date: string) {
  const lots = visibleLots(db, branch);
  const lotIds = [...lots.map((lot) => lot.id), ""];
  const pendingLots = lots.filter(
    (lot) => pendingReceiveKg(db, lot.id, branch) > 0,
  );
  const pendingKg = pendingLots.reduce(
    (total, lot) => total + pendingReceiveKg(db, lot.id, branch),
    0,
  );
  const materialTransfers = pendingMaterialTransfers(db, branch);
  // One `materials` entry per branch+date covers all 7 rows, so the day is either
  // counted or not counted at all.
  const materialsCounted =
    entries(db, "materials", undefined, branch, date).length > 0;
  const uncountedMaterials = materialsCounted ? 0 : materials.length;
  const frozen = lotIds.filter((id) => balance(db, id, branch).frozen > 0.001);
  const ready = lotIds.filter((id) => balance(db, id, branch).ready > 0.001);
  const thawDone = entries(db, "thaw", undefined, branch, date).length > 0;
  const saleDone = entries(db, "sale", undefined, branch, date).length > 0;
  const closed = isClosed(db, branch, date);
  const missing = closeDayChecklist(db, branch, date).filter(
    (item) => item.required && !item.done,
  ).length;

  const editAlerts = editRequestAlerts(db, "branch", branch);
  const dayAlerts: Notification[] = [
    // 1. รับเนื้อเข้าสาขา — one line whatever the number of allocations.
    ...(pendingLots.length
      ? [
          {
            title: `รับเนื้อเข้าสาขา ${pendingLots.length} Lot`,
            detail: `Owner จัดสรรมา ${fmt(pendingKg)} กก. ยังไม่ได้รับเข้าสาขา${branch}`,
            tab: "day" as const,
          },
        ]
      : []),
    // 2. แบ่งละลายเนื้อ — only while the day has no thaw of its own.
    ...(frozen.length && !thawDone
      ? [
          {
            title: `ยังไม่แบ่งละลายเนื้อวันที่ ${date}`,
            detail: `มีเนื้อแช่แข็ง ${frozen.length} Lot · เลือกเนื้อที่จะละลายก่อนขาย`,
            tab: "day" as const,
          },
        ]
      : []),
    // 3. บันทึกยอดขาย — the same "ต้องกรอกก่อนปิดวัน" the day table shows.
    ...(ready.length && !saleDone
      ? [
          {
            title: `ยังไม่บันทึกยอดขายวันที่ ${date}`,
            detail: "มีเนื้อละลายพร้อมขาย · ต้องกรอกยอดขายก่อนปิดวัน",
            tab: "day" as const,
          },
        ]
      : []),
    // 4. ปิดวัน — closeDayChecklist decides, exactly as the close dialog does.
    ...(closed
      ? []
      : [
          {
            title: missing
              ? `ยังขาด ${missing} รายการก่อนปิดวันที่ ${date}`
              : `พร้อมปิดวันที่ ${date}`,
            detail: missing
              ? "เปิดหน้ากรอกรายวันเพื่อดูว่ายังขาดอะไร"
              : "กรอกครบแล้ว · ตรวจและปิดวันได้เลย",
            tab: "day" as const,
          },
        ]),
  ];

  // The two material tabs, each with its own line so the bell and the pill agree.
  const receiveAlerts: Notification[] = materialTransfers.length
    ? [
        {
          title: `วัสดุรอยืนยันรับ ${materialTransfers.length} รายการ`,
          detail: "ตรวจจำนวนที่มาถึงจริงแล้วกดยืนยันรับ",
          tab: "material-receive" as const,
        },
      ]
    : [];
  const countAlerts: Notification[] = uncountedMaterials
    ? [
        {
          title: `ยังไม่ตรวจนับสต๊อกวัสดุวันที่ ${date}`,
          detail: `นับของจริง ${uncountedMaterials} รายการแล้วกดบันทึก`,
          tab: "material-count" as const,
        },
      ]
    : [];

  return {
    notifications: [
      ...editAlerts,
      ...dayAlerts,
      ...receiveAlerts,
      ...countAlerts,
    ],
    dayTasks: dayAlerts.length,
    badges: {
      day: dayAlerts.length,
      "material-receive": materialTransfers.length,
      "material-count": uncountedMaterials,
      history: editAlerts.length,
    } satisfies Partial<Record<Tab, number>>,
  };
}
