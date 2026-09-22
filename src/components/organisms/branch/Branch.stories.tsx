import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  chillDb,
  closeReadyDb,
  day,
  dayClosedDb,
  demoDb,
  materialTransferDb,
  nextDay,
  open,
} from "../../../../.storybook/fixtures";
import { closeDayChecklist, isClosed, requiredRiceKinds } from "@/lib/store";
import { BranchDailyWorkflow } from "./BranchDailyWorkflow";
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
    />
  ),
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

/** Every required item done: the optional influencer-box row still reads "ยังไม่บันทึก"
 *  with its own ไปกรอก, and the day can close anyway. */
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

/** ยอดขาย/ของเสีย อยู่ในขั้นที่ 3 ของ BranchDailyWorkflow — ตารางนี้เหลือเฉพาะกล่องโปรโมท */
export const InfluencerBoxTasks: Story = {
  render: () => (
    <DailyTaskTable
      title="กล่องโปรโมทอินฟลูเอนเซอร์"
      kinds={["influencerBox"]}
      db={db}
      branch={branch}
      date={day}
      disabled={closed}
      hasLots
      open={open}
    />
  ),
};

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
