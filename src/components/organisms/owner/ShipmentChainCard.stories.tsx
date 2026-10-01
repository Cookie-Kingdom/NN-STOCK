import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { shipments, type Database } from "@/lib/store";
import {
  demoDb,
  dispatchDb,
  dispatchedDb,
  packingShortDb,
  partialBatchDb,
  returnGapDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { ShipmentChainCard } from "./ShipmentChainCard";

const meta: Meta = {
  title: "Organisms/Owner/ShipmentChainCard",
};

export default meta;
type Story = StoryObj<{ db: Database }>;

const chainState = pick("สถานะ", {
  กลับถึงตู้แล้ว: returnGapDb,
  กำลังส่ง: dispatchedDb,
  "รอ Packing List": dispatchDb,
  "Packing List ต่ำกว่า PO รมควัน": packingShortDb,
  มีแค่รับและรมควัน: partialBatchDb,
  ตัวอย่าง: demoDb,
});

/** The latest shipment's linked records, as an unnumbered list: a record not written yet
 *  reads "—" whatever the others hold. เลือกสถานะใน Controls:
 *  - กลับถึงตู้แล้ว: back in Foodiva's freezer, every record filled; Chef House weighed in
 *    1 kg under, Foodiva 0.5 kg under.
 *  - กำลังส่ง: on the truck to Chef House, the other records read "—".
 *  - รอ Packing List: smoke PO waiting for Foodiva, "ส่งไป" shows the smoke PO's kg,
 *    no gap badge.
 *  - Packing List ต่ำกว่า PO รมควัน: smoke PO 1,500 kg, Packing List 70 kg, Chef House
 *    69 kg; "ส่งไป" is 70 and the gap −1 kg.
 *  - มีแค่รับและรมควัน: Chef House weighed in and smoked a batch nobody issued a PO for or
 *    trucked; PO ซื้อ, ส่งไป and the return legs read "—" (DASH-05).
 *  - ตัวอย่าง: the seven-day demo run, allocated and sold. */
export const ShipmentChain: Story = {
  argTypes: { db: chainState.argType },
  args: { db: chainState.initial },
  render: ({ db }) => <ShipmentChainCard db={db} lot={shipments(db).at(-1)!} />,
};
