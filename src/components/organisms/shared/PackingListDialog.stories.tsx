import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  cmReceivedDb,
  multiPoPackedDb,
  packedDb,
} from "../../../../.storybook/fixtures";
import { PackingListDialog } from "./PackingListDialog";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Organisms/Shared/PackingListDialog",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: packedDb },
};

export default meta;
type Story = StoryObj;

/** What the Owner opens from the smoke PO tab: the purchase POs the shipment covers
 *  ("PO ซื้อในการส่งนี้"), then Foodiva's list and its totals. */
export const Owner: Story = {
  render: () => (
    <PackingListDialog
      db={packedDb}
      lotId={packedDb.lots.at(-1)!.id}
      onClose={fn()}
      showPurchaseOrders
    />
  ),
};

/** One shipment from three purchase POs: each with its Foodiva invoice and the kg asked. */
export const OwnerMultiPo: Story = {
  parameters: { db: multiPoPackedDb },
  render: () => (
    <PackingListDialog
      db={multiPoPackedDb}
      lotId={multiPoPackedDb.lots.at(-1)!.id}
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
