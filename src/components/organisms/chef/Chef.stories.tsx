import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  demoDb,
  open,
  rejectedInvoiceDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { ChefLotTable } from "./ChefLotTable";
import { ChefReceiveTable } from "./ChefReceiveTable";

const meta: Meta = { title: "Organisms/Chef" };

export default meta;
type Story = StoryObj;

export const LotTableSmoked: Story = {
  parameters: { db: smokedDb },
  render: () => <ChefLotTable db={smokedDb} lots={smokedDb.lots} open={open} />,
};

export const LotTableClosed: Story = {
  parameters: { db: demoDb },
  render: () => <ChefLotTable db={demoDb} lots={demoDb.lots} open={open} />,
};

// The Owner sent the smoking invoice back: the row shows the reason next to the fix button.
export const LotTableInvoiceSentBack: Story = {
  parameters: { db: rejectedInvoiceDb },
  render: () => (
    <ChefLotTable
      db={rejectedInvoiceDb}
      lots={rejectedInvoiceDb.lots}
      open={open}
    />
  ),
};

export const ReceiveTable: Story = {
  parameters: { db: demoDb },
  render: () => <ChefReceiveTable db={demoDb} open={open} />,
};
