import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  chillDb,
  day,
  demoDb,
  nextDay,
  open,
} from "../../../../.storybook/fixtures";
import { branches } from "@/lib/store";
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
type Story = StoryObj;

export const MeatStockOwner: Story = {
  render: () => (
    <MeatStockTable db={db} role="owner" branch="" lots={db.lots} open={open} />
  ),
};

export const MeatStockBranch: Story = {
  render: () => (
    <MeatStockTable
      db={db}
      role="branch"
      branch="ศาลาแดง"
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

/** Branch view, end of day 1: 70 kg received and thawed, 65.5 kg used, 4.5 kg ชิล. */
export const StockSummaryBranch: Story = {
  parameters: { db: chillDb },
  render: () => (
    <BranchStockSummary db={chillDb} branches={["ศาลาแดง"]} initialDate={day} />
  ),
};

/** The next day: 4.5 kg ชิลยกมา, nothing moved yet. */
export const StockSummaryBranchNextDay: Story = {
  parameters: { db: chillDb },
  render: () => (
    <BranchStockSummary
      db={chillDb}
      branches={["ศาลาแดง"]}
      initialDate={nextDay}
    />
  ),
};

/** Owner view: the same summary with a branch picker. */
export const StockSummaryOwner: Story = {
  render: () => <BranchStockSummary db={db} branches={branches} />,
};
