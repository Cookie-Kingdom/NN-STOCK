import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  demoDb,
  materialTransferDb,
  open,
} from "../../../../.storybook/fixtures";
import { isClosed } from "@/lib/store";
import { BranchDailyWorkflow } from "./BranchDailyWorkflow";
import { ChiliDailySummary } from "./ChiliDailySummary";
import { DailyMaterialsTable } from "./DailyMaterialsTable";
import { DailySummary } from "./DailySummary";
import { DailyTaskTable } from "./DailyTaskTable";
import { MaterialReceiptConfirmation } from "./MaterialReceiptConfirmation";

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

export const RiceTasks: Story = {
  render: () => (
    <DailyTaskTable
      title="ข้าวเหนียวดิบ · ซื้อที่สาขาศาลาแดง"
      kinds={["ricePurchase", "riceIssue", "rice"]}
      db={db}
      branch={branch}
      date={day}
      disabled={closed}
      hasLots
      open={open}
    />
  ),
};

export const SalesTasks: Story = {
  render: () => (
    <DailyTaskTable
      title="ยอดขายและปิดวัน (Sales & day close)"
      kinds={["sale", "influencerBox", "closeDay"]}
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
// "เกินจำนวนที่ส่ง" check) needs a database with one still outstanding.
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
