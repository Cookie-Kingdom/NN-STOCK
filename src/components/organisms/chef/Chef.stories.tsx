import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  demoDb,
  dispatchedDb,
  open,
  rejectedInvoiceDb,
  returnTruckDb,
  smokedDb,
  smokeOrderDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { visibleDatabase, type Database } from "@/lib/store";
import { ChefLotTable } from "./ChefLotTable";
import { ChefReceiveTable } from "./ChefReceiveTable";

const meta: Meta = { title: "Organisms/Chef" };

export default meta;
type Story = StoryObj<{ db: Database }>;

/** What Chef House's screens get: shipments only, no purchase PO number or price. */
const chef = (db: Database) => visibleDatabase(db, "cm");

const lotState = pick("สถานะ", {
  "รอรับ PO รมควัน": smokeOrderDb,
  รมควันแล้ว: smokedDb,
  "รอออก Invoice": returnTruckDb,
  ปิดแล้ว: demoDb,
  "Invoice ถูกส่งกลับ": rejectedInvoiceDb,
});

/** เลือกสถานะใน Controls:
 *  - รอรับ PO รมควัน: stage 2 with the smoke PO not accepted yet; the row offers the PO
 *    button and still points at the receive tab, because the meat can be weighed in
 *    before the PO is accepted.
 *  - รมควันแล้ว: stage 5, edit the yellow cells or close the run.
 *  - รอออก Invoice: closed run with no smoking invoice yet; the invoice button appears
 *    only now.
 *  - ปิดแล้ว: the seven-day demo run, closed.
 *  - Invoice ถูกส่งกลับ: the Owner sent the smoking invoice back; the row shows the reason
 *    next to the fix button. */
export const LotTable: Story = {
  argTypes: { db: lotState.argType },
  args: { db: lotState.initial },
  render: ({ db }) => (
    <ChefLotTable db={chef(db)} lots={chef(db).lots} open={open} />
  ),
};

/** A shipment on the truck: shipment number, Packing List boxes and kg, vehicle. */
export const ReceiveTable: Story = {
  parameters: { db: dispatchedDb },
  render: () => <ChefReceiveTable db={chef(dispatchedDb)} open={open} />,
};
