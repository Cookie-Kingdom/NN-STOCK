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
  cooksRice,
  isClosed,
  requiredRiceKinds,
  visibleLots,
} from "@/lib/store";
import { BranchDailyWorkflow } from "./BranchDailyWorkflow";
import { BranchStockView } from "./BranchStockView";
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
  closed: boolean;
  disabled: boolean;
  hasLots: boolean;
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
  มีใบโอนค้างรับ: materialTransferDb,
  ไม่มีใบโอนค้าง: db,
});
const chiliState = pick("น้ำพริก", {
  ยังไม่ตรวจนับ: db,
  นับตรง: chiliMatchDb,
  นับไม่ตรง: chiliMismatchDb,
});
const riceState = pick("ข้อมูล", {
  บันทึกครบแล้ว: db,
  ยังไม่ยกข้าวไปวันถัดไป: chillDb,
});

/** Pick the day's state in Controls: เปิดวัน, after ปิดวัน (status reads locked and
 *  every action is disabled), or "ไม่ระบุ Lot" (meat received with no batch: thawing
 *  and selling open on that bucket). "รับของ" is always open, allocation or not. */
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

/** The checklist on its own. ยังไม่ครบ: materials and cooked rice still missing.
 *  ครบแล้ว: every required item done, the day can close (influencer giveaways are
 *  entered inside the close dialog itself, not as a row here). */
export const CloseChecklist: Story = {
  argTypes: {
    db: checklistState.argType,
    actions: { name: "มีปุ่มไปกรอก (onGo)", control: "boolean" },
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
 *  ข้อมูล = "ยังไม่ยกข้าวไปวันถัดไป" marks the rows closing still needs; disabled = the
 *  day is closed; hasLots off = no Lot at the branch yet. */
export const RiceTasks: Story = {
  argTypes: {
    branch: branchArg,
    db: riceState.argType,
    disabled: { control: "boolean" },
    hasLots: { control: "boolean" },
  },
  args: {
    branch,
    db: riceState.initial,
    disabled: false,
    hasLots: true,
  },
  render: ({ branch, db, disabled, hasLots }) => (
    <DailyTaskTable
      title={
        cooksRice(branch)
          ? "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก"
          : "ข้าวเหนียว · ซื้อข้าวสุกจากข้างนอก"
      }
      kinds={
        cooksRice(branch)
          ? ["ricePurchase", "riceIssue", "rice", "riceCarry"]
          : ["ricePurchase", "riceCarry"]
      }
      required={requiredRiceKinds(db, branch, day)}
      db={db}
      branch={branch}
      date={day}
      disabled={disabled}
      hasLots={hasLots}
      open={open}
    />
  ),
};

/** ล็อกไว้เป็นค่าเริ่มต้นเหมือนตาราง "ตั้งค่า" ของ Owner. เลือกสถานะใน Controls:
 *  - นับแล้ว: ยอดที่บันทึกไว้ของวันนี้อ่านเป็นตัวอักษรล้วน ไม่มีช่องกรอก
 *  - ยังไม่นับ: ทุกช่องเป็น "—" และปุ่มเดียวคือ "ตรวจนับวัสดุวันนี้"
 *  - ปิดวันแล้ว: ตารางล็อกถาวร ปุ่มบอกเหตุผลและกดไม่ได้ */
export const Materials: Story = {
  argTypes: { db: materialsState.argType },
  args: { db: materialsState.initial },
  render: ({ db }) => (
    <DailyMaterialsTable
      db={db}
      branch={branch}
      date={day}
      onDate={fn()}
      disabled={isClosed(db, branch, day)}
    />
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
// name the Owner wrote on the transfer. closed = the day is locked.
export const MaterialReceipt: Story = {
  argTypes: { db: receiptState.argType, closed: { control: "boolean" } },
  args: { db: receiptState.initial, closed: false },
  render: ({ db, closed }) => (
    <MaterialReceiptConfirmation
      db={db}
      branch={branch}
      date={day}
      onDate={fn()}
      closed={closed}
    />
  ),
};

/** "รับวัสดุโดยไม่มีใบโอน" opened: material, quantity and receiver are typed by the
 *  branch; บันทึกรับวัสดุ saves a materialConfirm with no transferId (MAT-01). */
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
