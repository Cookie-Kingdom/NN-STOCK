import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { shipments, type Database } from "@/lib/store";
import {
  demoDb,
  dispatchDb,
  dispatchedDb,
  packingShortDb,
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
  "Packing List ต่ำกว่า Request": packingShortDb,
  ตัวอย่าง: demoDb,
});

/** The latest shipment's chain. เลือกสถานะใน Controls:
 *  - กลับถึงตู้แล้ว: back in Foodiva's freezer, every step filled; Chef House weighed in
 *    1 kg under, Foodiva 0.5 kg under.
 *  - กำลังส่ง: on the truck to Chef House, later steps read "รอดำเนินการ".
 *  - รอ Packing List: Request waiting for Foodiva, "ส่งไป" shows the Request kg as asked
 *    for, no gap badge.
 *  - Packing List ต่ำกว่า Request: Request 1,500 kg, Packing List 70 kg, Chef House
 *    69 kg; "ส่งไป" is 70 and the gap −1 kg.
 *  - ตัวอย่าง: the seven-day demo run, allocated and sold. */
export const ShipmentChain: Story = {
  argTypes: { db: chainState.argType },
  args: { db: chainState.initial },
  render: ({ db }) => <ShipmentChainCard db={db} lot={shipments(db).at(-1)!} />,
};
