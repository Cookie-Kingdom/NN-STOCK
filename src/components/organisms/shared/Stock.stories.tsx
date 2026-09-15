import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { demoDb, open, smokedDb } from "../../../../.storybook/fixtures";
import { branches } from "@/lib/store";
import { LotDetails } from "./LotDetails";
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

export const LotDetailsOwner: Story = {
  render: () => <LotDetails db={db} lot={db.lots[0]} role="owner" branch="" />,
};

export const LotDetailsSmoking: Story = {
  parameters: { db: smokedDb },
  render: () => (
    <LotDetails db={smokedDb} lot={smokedDb.lots[0]} role="cm" branch="" />
  ),
};
