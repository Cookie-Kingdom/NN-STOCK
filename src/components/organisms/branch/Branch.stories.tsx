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
} from "../../../../.storybook/fixtures";
import {
  closeDayChecklist,
  entries,
  isClosed,
  requiredRiceKinds,
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
const closed = isClosed(db, branch, day);
/** The same list the workspace hands the branch: Lots allocated to this branch only. */
const branchLots = db.lots.filter(
  (lot) => entries(db, "allocate", lot.id, branch).length > 0,
);

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
type Story = StoryObj;

export const DailyWorkflow: Story = {
  render: () => (
    <BranchDailyWorkflow
      db={db}
      branch={branch}
      date={day}
      lots={db.lots}
      closed={closed}
      open={open}
      onTab={fn()}
    />
  ),
};

/** The one close button, after ปิดวัน: status reads locked and every action is disabled. */
export const DailyWorkflowClosed: Story = {
  parameters: { db: dayClosedDb },
  render: () => (
    <BranchDailyWorkflow
      db={dayClosedDb}
      branch={branch}
      date={day}
      lots={dayClosedDb.lots}
      closed={isClosed(dayClosedDb, branch, day)}
      open={open}
      onTab={fn()}
    />
  ),
};

/** สต๊อก: ทุกอย่างที่อยู่ที่สาขานี้จริง ๆ ในตารางเดียว กรองด้วยกลุ่มสต๊อกและรายการ */
export const StockView: Story = {
  render: () => <BranchStockView db={db} branch={branch} lots={branchLots} />,
};

/** กลุ่มสต๊อก = เนื้อ: เหลือเฉพาะ Lot ที่สาขานี้ถือหรือรออยู่ */
export const StockViewMeat: Story = {
  render: StockView.render,
  play: pickGenre("เนื้อ"),
};

/** กลุ่มสต๊อก = วัตถุดิบ: ข้าวสาร ข้าวสุก และน้ำพริกหลอดของสาขา */
export const StockViewSupplies: Story = {
  render: StockView.render,
  play: pickGenre("วัตถุดิบ"),
};

/** กลุ่มสต๊อก = วัสดุบรรจุภัณฑ์: วัสดุทั้ง 7 รายการ พร้อมฐานและราคาต่อชิ้น */
export const StockViewMaterials: Story = {
  render: StockView.render,
  play: pickGenre("วัสดุบรรจุภัณฑ์"),
};

/** The checklist on its own: materials and cooked rice still missing. */
export const CloseChecklistMissing: Story = {
  parameters: { db: chillDb },
  render: () => (
    <CloseDayChecklist
      items={closeDayChecklist(chillDb, branch, day)}
      onGo={open}
    />
  ),
};

/** Every required item done: the day can close. Influencer giveaways are no longer a
 *  row here — they are entered inside the close dialog itself. */
export const CloseChecklistReady: Story = {
  parameters: { db: closeReadyDb },
  render: () => (
    <CloseDayChecklist
      items={closeDayChecklist(closeReadyDb, branch, day)}
      onGo={open}
    />
  ),
};

export const RiceTasks: Story = {
  render: () => (
    <DailyTaskTable
      title="ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก"
      kinds={["ricePurchase", "riceIssue", "rice", "riceCarry"]}
      required={requiredRiceKinds(db, branch, day)}
      db={db}
      branch={branch}
      date={day}
      disabled={closed}
      hasLots
      open={open}
    />
  ),
};

/** ล็อกไว้เป็นค่าเริ่มต้นเหมือนตาราง "ตั้งค่า" ของ Owner: ยอดที่บันทึกไว้ของวันนี้
 *  อ่านเป็นตัวอักษรล้วน ไม่มีช่องกรอกและไม่มีปุ่มบันทึกค้างอยู่บนหน้าจอ */
export const Materials: Story = {
  render: () => (
    <DailyMaterialsTable
      db={db}
      branch={branch}
      date={day}
      onDate={fn()}
      disabled={false}
    />
  ),
};

/** ล็อกไว้เหมือนกัน แต่ยังไม่เคยตรวจนับวันนี้: ทุกช่องเป็น "—" และปุ่มเดียวคือ
 *  "ตรวจนับวัสดุวันนี้" */
export const MaterialsNotCounted: Story = {
  parameters: { db: branchTasksDb },
  render: () => (
    <DailyMaterialsTable
      db={branchTasksDb}
      branch={branch}
      date={day}
      onDate={fn()}
      disabled={false}
    />
  ),
};

/** โหมดแก้ไข: กด "ขอแก้ไขยอดนับ" แล้วช่องกรอกจึงปรากฏ พร้อมกล่องเหตุผลที่แก้ไข
 *  (บังคับกรอกเมื่อวันนี้เคยบันทึกไว้แล้ว) และปุ่ม ยกเลิก / บันทึกและล็อก */
export const MaterialsEditing: Story = {
  render: Materials.render,
  play: async ({ canvasElement }) => {
    fireEvent.click(
      within(canvasElement).getByRole("button", { name: /ขอแก้ไขยอดนับ/ }),
    );
  },
};

/** ปิดวันแล้ว: ตารางล็อกถาวร ปุ่มบอกเหตุผลและกดไม่ได้ */
export const MaterialsClosedDay: Story = {
  parameters: { db: dayClosedDb },
  render: () => (
    <DailyMaterialsTable
      db={dayClosedDb}
      branch={branch}
      date={day}
      onDate={fn()}
      disabled={isClosed(dayClosedDb, branch, day)}
    />
  ),
};

// demoDb confirms every shipment it makes, so the pending-row state (and its live
// "เกินจำนวนที่ส่ง" check) needs a database with one still outstanding. The received
// quantity starts at the sent one ("ตามยอดส่ง", expected) and the receiver at the
// name the Owner wrote on the transfer.
export const MaterialReceipt: Story = {
  parameters: { db: materialTransferDb },
  render: () => (
    <MaterialReceiptConfirmation
      db={materialTransferDb}
      branch={branch}
      date={day}
      onDate={fn()}
      closed={false}
    />
  ),
};

export const Summary: Story = {
  render: () => (
    <>
      <DailySummary db={db} branch={branch} date={day} />
      <ChiliDailySummary db={db} branch={branch} date={day} />
    </>
  ),
};

/** 70 kg thawed, 65.5 kg used: 4.5 kg คงเหลือชิล goes to tomorrow, and the day can close. */
export const MeatDay: Story = {
  parameters: { db: chillDb },
  render: () => <MeatDaySummary db={chillDb} branch={branch} date={day} />,
};

/** The next day: yesterday's 4.5 kg shows as ชิลยกมา. */
export const MeatDayChillCarriedIn: Story = {
  parameters: { db: chillDb },
  render: () => <MeatDaySummary db={chillDb} branch={branch} date={nextDay} />,
};
