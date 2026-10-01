import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, fn, within } from "storybook/test";
import {
  branchTasksDb,
  chillDb,
  closeReadyDb,
  day,
  dayClosedDb,
  demoDb,
  materialTransferDb,
  nextDay,
  open,
  unlinkedBranchDb,
} from "../../../../.storybook/fixtures";
import {
  chiliMatchDb,
  chiliMismatchDb,
} from "../../../../.storybook/fixtures-F1";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import {
  closeDayChecklist,
  isClosed,
  requiredRiceKinds,
  visibleLots,
} from "@/lib/store";
import { BranchDailyWorkflow } from "./BranchDailyWorkflow";
import { BranchStockView } from "./BranchStockView";
import { BranchTodayFeed } from "./BranchTodayFeed";
import { CloseDayChecklist } from "./CloseDayChecklist";
import { ChiliDailySummary } from "./ChiliDailySummary";
import { DailyMaterialsTable } from "./DailyMaterialsTable";
import { DailySummary } from "./DailySummary";
import { DailyTaskTable } from "./DailyTaskTable";
import { MaterialReceiptConfirmation } from "./MaterialReceiptConfirmation";
import { MeatDaySummary } from "./MeatDaySummary";

const db = demoDb;
const branch = "ศาลาแดง";

/** Storybook's stand-in for the user picking a กลุ่มสต๊อก in the filter bar. */
const pickGenre =
  (genre: string): Story["play"] =>
  async ({ canvasElement }) => {
    fireEvent.change(within(canvasElement).getByLabelText("กลุ่มสต๊อก"), {
      target: { value: genre },
    });
  };

const meta: Meta = {
  title: "Organisms/Branch",
  parameters: { db },
};

export default meta;
type Story = StoryObj<{
  db: Database;
  date: string;
  branch: string;
  actions: boolean;
}>;

/** Controls: which branch the organism renders for. */
const branchArg = {
  name: "สาขา",
  options: ["ศาลาแดง", "มีนบุรี"],
  control: "radio" as const,
};

const dayState = pick("วัน", {
  เปิดวัน: db,
  ปิดวันแล้ว: dayClosedDb,
  "ไม่ระบุ Lot": unlinkedBranchDb,
});
const checklistState = pick("สถานะ", {
  ยังไม่ครบ: chillDb,
  ครบแล้ว: closeReadyDb,
});
const materialsState = pick("สถานะ", {
  นับแล้ว: db,
  ยังไม่นับ: branchTasksDb,
  ปิดวันแล้ว: dayClosedDb,
});
const meatDay = pick("วัน", { วันนี้: day, วันถัดไป: nextDay });
const meatDayDb = pick("ข้อมูล", {
  ชิลยกไปพรุ่งนี้: chillDb,
  "ไม่ระบุ Lot": unlinkedBranchDb,
});
const stockState = pick("ข้อมูล", {
  "ผูก Lot แล้ว": db,
  "ไม่ระบุ Lot": unlinkedBranchDb,
});
const receiptState = pick("ข้อมูล", {
  มีใบโอนรอยืนยันรับ: materialTransferDb,
  ไม่มีใบโอนรอยืนยันรับ: db,
});
const chiliState = pick("น้ำพริก", {
  ยังไม่ตรวจนับ: db,
  นับตรง: chiliMatchDb,
  นับไม่ตรง: chiliMismatchDb,
});
const riceState = pick("ข้อมูล", {
  จดครบแล้ว: db,
  ยังไม่ยกข้าวไปวันถัดไป: chillDb,
});
const feedState = pick("ข้อมูล", {
  มีรายการ: dayClosedDb,
  "ไม่ระบุ Lot": unlinkedBranchDb,
  ยังไม่มีรายการ: branchTasksDb,
});

/** จดวันนี้: a plain list, no numbering and no order. Every button is live whatever the
 *  stock (thawing or selling with no meat opens on the "ไม่ระบุ Lot" bucket and the store
 *  only warns); what is not jotted reads "ยังไม่ได้จด" on a neutral chip. Pick the day's
 *  state in Controls: เปิดวัน, after ปิดวัน (status reads closed; only ตรวจและปิดวัน is
 *  disabled), or "ไม่ระบุ Lot" (meat received with no batch). */
export const DailyWorkflow: Story = {
  argTypes: { db: dayState.argType },
  args: { db: dayState.initial },
  render: ({ db }) => (
    <BranchDailyWorkflow
      db={db}
      branch={branch}
      date={day}
      lots={visibleLots(db, branch)}
      closed={isClosed(db, branch, day)}
      open={open}
      onTab={fn()}
    />
  ),
};

/** จดแล้ววันนี้, under จดวันนี้ on the day tab: the branch's own entries of the working
 *  date, newest first, as the Log's rows (open one to see what was jotted). มีรายการ: a
 *  full day through ปิดวัน. "ไม่ระบุ Lot": rows carrying the "ยังไม่ผูก Lot" badge.
 *  ยังไม่มีรายการ: the empty line. */
export const TodayFeed: Story = {
  argTypes: { db: feedState.argType },
  args: { db: feedState.initial },
  render: ({ db }) => (
    <BranchTodayFeed db={db} branch={branch} date={day} onChanged={fn()} />
  ),
};

/** สต๊อก: ทุกอย่างที่อยู่ที่สาขานี้จริง ๆ ในตารางเดียว กรองด้วยกลุ่มสต๊อกและรายการ.
 *  ข้อมูล = "ไม่ระบุ Lot": แถว "ไม่ระบุ Lot · เนื้อรมควัน" พร้อมป้าย "ยังไม่ผูก Lot" และวัสดุ
 *  ที่รับโดยไม่มีใบโอนนับเข้าสต๊อกวัสดุ (materials[0] +50). Lots are the same list the
 *  workspace hands the branch (BR-07): allocated to it or holding its own entries. */
export const StockView: Story = {
  argTypes: { db: stockState.argType },
  args: { db: stockState.initial },
  render: ({ db }) => (
    <BranchStockView db={db} branch={branch} lots={visibleLots(db, branch)} />
  ),
};

/** กลุ่มสต๊อก = เนื้อ: เหลือเฉพาะ Lot ที่สาขานี้ถือหรือรออยู่ */
export const StockViewMeat: Story = {
  ...StockView,
  play: pickGenre("เนื้อ"),
};

/** กลุ่มสต๊อก = วัตถุดิบ: ข้าวสาร ข้าวสุก และน้ำพริกหลอดของสาขา */
export const StockViewSupplies: Story = {
  ...StockView,
  play: pickGenre("วัตถุดิบ"),
};

/** กลุ่มสต๊อก = วัสดุบรรจุภัณฑ์: วัสดุทั้งหมด พร้อมฐานและราคาต่อชิ้น */
export const StockViewMaterials: Story = {
  ...StockView,
  play: pickGenre("วัสดุบรรจุภัณฑ์"),
};

/** สรุปก่อนปิดวัน on its own. ยังไม่ครบ: materials and cooked rice read "ยังไม่ได้จด" and
 *  the note under the table is neutral (the day can close anyway). ครบแล้ว: every item
 *  reads "จดแล้ว" (influencer giveaways are entered inside the sale form, not as a row
 *  here). */
export const CloseChecklist: Story = {
  argTypes: {
    db: checklistState.argType,
    actions: { name: "มีปุ่มจด (onGo)", control: "boolean" },
  },
  args: { db: checklistState.initial, actions: true },
  render: ({ db, actions }) => (
    <CloseDayChecklist
      items={closeDayChecklist(db, branch, day)}
      onGo={actions ? open : undefined}
    />
  ),
};

/** ข้าวเหนียว. สาขา: ศาลาแดง นึ่งเองหรือซื้อข้าวสุก (4 แถว), มีนบุรี ซื้อข้าวสุกอย่างเดียว.
 *  ข้อมูล = "ยังไม่ยกข้าวไปวันถัดไป" shows the rows reading "ยังไม่ได้จด"; every จด button is live. */
export const RiceTasks: Story = {
  argTypes: {
    branch: branchArg,
    db: riceState.argType,
  },
  args: {
    branch,
    db: riceState.initial,
  },
  render: ({ branch, db }) => (
    <DailyTaskTable
      title="ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก"
      kinds={["ricePurchase", "riceIssue", "rice", "riceCarry"]}
      required={requiredRiceKinds(db, branch, day)}
      db={db}
      branch={branch}
      date={day}
      open={open}
    />
  ),
};

/** ล็อกไว้เป็นค่าเริ่มต้นเหมือนตาราง "ตั้งค่า" ของ Owner. เลือกสถานะใน Controls:
 *  - นับแล้ว: ยอดที่บันทึกไว้ของวันนี้อ่านเป็นตัวอักษรล้วน ไม่มีช่องกรอก
 *  - ยังไม่นับ: ทุกช่องเป็น "—" และปุ่มเดียวคือ "ตรวจนับวัสดุวันนี้"
 *  - ปิดวันแล้ว: ยังกด "ขอแก้ไขยอดนับ" ได้ตามปกติ */
export const Materials: Story = {
  argTypes: { db: materialsState.argType },
  args: { db: materialsState.initial },
  render: ({ db }) => (
    <DailyMaterialsTable db={db} branch={branch} date={day} onDate={fn()} />
  ),
};

/** โหมดแก้ไข: กด "ขอแก้ไขยอดนับ" แล้วช่องกรอกจึงปรากฏ พร้อมกล่องเหตุผลที่แก้ไข
 *  (บังคับกรอกเมื่อวันนี้เคยบันทึกไว้แล้ว) และปุ่ม ยกเลิก / บันทึกและล็อก */
export const MaterialsEditing: Story = {
  ...Materials,
  // demoDb's day is closed; closeReadyDb has the count saved on a day still open.
  args: { db: closeReadyDb },
  play: async ({ canvasElement }) => {
    fireEvent.click(
      within(canvasElement).getByRole("button", { name: /ขอแก้ไขยอดนับ/ }),
    );
  },
};

// demoDb confirms every shipment it makes, so the pending-row state (and its live
// "เกินจำนวนที่ส่ง" check) needs a database with one still outstanding. The received
// quantity starts at the sent one ("ตามยอดส่ง", expected) and the receiver at the
// name the Owner wrote on the transfer.
export const MaterialReceipt: Story = {
  argTypes: { db: receiptState.argType },
  args: { db: receiptState.initial },
  render: ({ db }) => (
    <MaterialReceiptConfirmation
      db={db}
      branch={branch}
      date={day}
      onDate={fn()}
    />
  ),
};

/** "รับวัสดุโดยไม่มีใบโอน" opened: a table of material + quantity rows (เพิ่มแถว adds one)
 *  and one receiver under it; บันทึกรับวัสดุ saves a materialConfirm with no transferId
 *  per row (MAT-01). */
export const MaterialReceiptNoTransfer: Story = {
  ...MaterialReceipt,
  play: async ({ canvasElement }) => {
    fireEvent.click(
      within(canvasElement).getByRole("button", {
        name: "รับวัสดุโดยไม่มีใบโอน",
      }),
    );
  },
};

/** สรุปรายวัน + น้ำพริก. สาขา switches the rows (มีนบุรี only buys cooked rice).
 *  น้ำพริก (ศาลาแดง, an open day with 20 tubes allocated and 2 sold): ยังไม่ตรวจนับ,
 *  นับตรง (badge ตรงกัน) or นับไม่ตรง (badge ยอดไม่ตรง + หมายเหตุส่วนต่าง). */
export const Summary: Story = {
  argTypes: { branch: branchArg, db: chiliState.argType },
  args: { branch, db: chiliState.initial },
  render: ({ branch, db }) => (
    <>
      <DailySummary db={db} branch={branch} date={day} />
      <ChiliDailySummary db={db} branch={branch} date={day} />
    </>
  ),
};

/** 70 kg thawed, 65.5 kg used: 4.5 kg คงเหลือชิล goes to tomorrow, and the day can
 *  close. Switch วัน to วันถัดไป: yesterday's 4.5 kg shows as ชิลยกมา. ข้อมูล =
 *  "ไม่ระบุ Lot": meat with no batch, the "ไม่ระบุ Lot" row with its "ยังไม่ผูก Lot"
 *  badge (6 kg thawed, 3 kg used, 3 kg chill to tomorrow). */
export const MeatDay: Story = {
  argTypes: { db: meatDayDb.argType, date: meatDay.argType },
  args: { db: meatDayDb.initial, date: meatDay.initial },
  render: ({ db, date }) => (
    <MeatDaySummary db={db} branch={branch} date={date} />
  ),
};
