import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  demoDb,
  dispatchedDb,
  open,
  rejectedInvoiceDb,
  returnTruckDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { visibleDatabase, type Database } from "@/lib/store";
import { ChefLotTable } from "./ChefLotTable";
import { ChefReceiveTable } from "./ChefReceiveTable";

const meta: Meta = { title: "Organisms/Chef" };

export default meta;
type Story = StoryObj;

/** What Chef House's screens get: shipments only, no purchase PO number or price. */
const chef = (db: Database) => visibleDatabase(db, "cm");

const lotTable = (db: Database): Story => ({
  parameters: { db },
  render: () => <ChefLotTable db={chef(db)} lots={chef(db).lots} open={open} />,
});

/** Stage 5: edit the yellow cells or close the run. */
export const LotTableSmoked: Story = lotTable(smokedDb);

/** Closed run with no smoking invoice yet: the invoice button appears only now. */
export const LotTableInvoiceDue: Story = lotTable(returnTruckDb);

export const LotTableClosed: Story = lotTable(demoDb);

// The Owner sent the smoking invoice back: the row shows the reason next to the fix button.
export const LotTableInvoiceSentBack: Story = lotTable(rejectedInvoiceDb);

/** A shipment on the truck: shipment number, Packing List boxes and kg, vehicle. */
export const ReceiveTable: Story = {
  parameters: { db: dispatchedDb },
  render: () => <ChefReceiveTable db={chef(dispatchedDb)} open={open} />,
};
