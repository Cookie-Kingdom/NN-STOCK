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
type Story = StoryObj<{ db: Database }>;

const shipment = pick("PO ซื้อ", {
  "PO เดียว": packedDb,
  "3 PO": multiPoPackedDb,
});

/** What the Owner opens from the smoke PO tab: the purchase POs the shipment covers
 *  ("PO ซื้อในการส่งนี้"), then Foodiva's list and its totals. เลือก PO ซื้อ ใน Controls:
 *  - PO เดียว: การส่งจาก PO ซื้อใบเดียว
 *  - 3 PO: การส่งเดียวจาก PO ซื้อสามใบ แต่ละใบมีใบแจ้งหนี้ Foodiva และ kg ที่ขอ */
export const Owner: Story = {
  argTypes: { db: shipment.argType },
  args: { db: shipment.initial },
  render: ({ db }) => (
    <PackingListDialog
      db={db}
      lotId={db.lots.at(-1)!.id}
      onClose={fn()}
      showPurchaseOrders
    />
  ),
};

/** After Chef House weighed in: the yellow cells are filled; Sliced Weight Lost stays as
 *  Foodiva typed it. Without `showPurchaseOrders`, no purchase PO is named. */
export const Received: Story = {
  parameters: { db: cmReceivedDb },
  render: () => (
    <PackingListDialog
      db={cmReceivedDb}
      lotId={cmReceivedDb.lots.at(-1)!.id}
      onClose={fn()}
    />
  ),
};
