import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  cmReceivedDb,
  multiPoPackedDb,
  packedDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { PackingListDialog } from "./PackingListDialog";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Organisms/Shared/PackingListDialog",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: packedDb },
};

export default meta;

const shipment = pick("การส่ง", {
  "PO เดียว": packedDb,
  "3 PO": multiPoPackedDb,
  "Chef House ชั่งแล้ว": cmReceivedDb,
});

/** เลือกใน Controls:
 *  - การส่ง:
 *    - PO เดียว: การส่งจาก PO ซื้อใบเดียว
 *    - 3 PO: การส่งเดียวจาก PO ซื้อสามใบ แต่ละใบมีใบแจ้งหนี้ Foodiva และ kg ที่ขอ
 *    - Chef House ชั่งแล้ว: มีน้ำหนักรับรวมของ Chef House ใต้น้ำหนักส่งรวม; Sliced Weight Lost คงตามที่ Foodiva พิมพ์
 *  - showPurchaseOrders: สิ่งที่ Owner เปิดจากแท็บ PO รมควัน — "PO ซื้อในการส่งนี้" ก่อน
 *    รายการของ Foodiva; ปิดแล้วไม่มีชื่อ PO ซื้อ */
export const PackingList: StoryObj<{
  db: Database;
  showPurchaseOrders: boolean;
}> = {
  argTypes: {
    db: shipment.argType,
    showPurchaseOrders: { control: "boolean" },
  },
  args: { db: shipment.initial, showPurchaseOrders: true },
  render: ({ db, showPurchaseOrders }) => (
    <PackingListDialog
      key={db.entries.length}
      db={db}
      lotId={db.lots.at(-1)!.id}
      onClose={fn()}
      showPurchaseOrders={showPurchaseOrders}
    />
  ),
};
