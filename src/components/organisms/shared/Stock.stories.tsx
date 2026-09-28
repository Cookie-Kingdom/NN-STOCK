import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  chillDb,
  day,
  demoDb,
  nextDay,
  open,
  unlinkedBranchDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { branches, type Role } from "@/lib/store";
import { BranchStockSummary } from "./BranchStockSummary";
import { MaterialStockTable } from "./MaterialStockTable";
import { MeatStockTable } from "./MeatStockTable";
import { SupplyStock } from "./SupplyStock";

const db = demoDb;

const meta: Meta = {
  title: "Organisms/Stock",
  parameters: { db },
};

export default meta;
type Story = StoryObj<{ role: Role; date: string }>;

/** เลือกมุมมองใน Controls: Owner เห็นทุกสาขา, สาขาเห็นเฉพาะศาลาแดง */
export const MeatStock: Story = {
  argTypes: {
    role: {
      name: "มุมมอง",
      control: { type: "radio", labels: { owner: "Owner", branch: "สาขา" } },
      options: ["owner", "branch"],
    },
  },
  args: { role: "owner" },
  render: ({ role }) => (
    <MeatStockTable
      key={role}
      db={db}
      role={role}
      branch={role === "branch" ? "ศาลาแดง" : ""}
      lots={db.lots}
      open={open}
    />
  ),
};

export const MaterialStockOwner: Story = {
  render: () => (
    <MaterialStockTable db={db} stockBranches={branches} ownerView />
  ),
};

export const Supply: Story = {
  render: () => <SupplyStock db={db} branches={branches} />,
};

const summaryDay = pick("วัน", { วันแรก: day, วันถัดไป: nextDay });

/** Branch view. เลือกวันใน Controls:
 *  - วันแรก: สิ้นวันที่ 1 รับเข้าและละลาย 70 kg ใช้ไป 65.5 kg เหลือชิล 4.5 kg
 *  - วันถัดไป: ชิลยกมา 4.5 kg ยังไม่มีการเคลื่อนไหว */
export const StockSummaryBranch: Story = {
  parameters: { db: chillDb },
  argTypes: { date: summaryDay.argType },
  args: { date: summaryDay.initial },
  render: ({ date }) => (
    <BranchStockSummary
      key={date}
      db={chillDb}
      branches={["ศาลาแดง"]}
      initialDate={date}
    />
  ),
};

/** Meat received with no batch: the "ไม่ระบุ Lot" row with its "ยังไม่ผูก Lot" badge
 *  (10 kg in, 4 kg frozen, 3 kg chill), also pickable in the 14-day Lot filter. */
export const StockSummaryUnlinked: Story = {
  parameters: { db: unlinkedBranchDb },
  render: () => (
    <BranchStockSummary
      db={unlinkedBranchDb}
      branches={["ศาลาแดง"]}
      initialDate={day}
    />
  ),
};

/** Owner view: the same summary with a branch picker. */
export const StockSummaryOwner: Story = {
  render: () => <BranchStockSummary db={db} branches={branches} />,
};
