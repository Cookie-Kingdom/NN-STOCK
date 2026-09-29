import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  dispatchDb,
  dispatchedDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { type Database } from "@/lib/store";
import { ChefReceiveForm } from "./ChefReceiveForm";

// A native modal <dialog>: a Docs page would stack it, hence `!autodocs`.
const meta: Meta = {
  title: "Organisms/Chef/ChefReceiveForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

const form = (db: Database, lotId: string) => (
  <ChefReceiveForm
    db={db}
    lotId={lotId}
    date={day}
    onDate={fn()}
    onClose={fn()}
    onSaved={fn()}
  />
);

/** A batch on the truck, as Chef House sees it: the 25 + 25 kg Packing List with the
 *  yellow cells prefilled at 25 and marked "ตาม Packing List" (expected), and the
 *  arrival time at the current slot. Type e.g. 24.5 in a cell — its marker goes, and a
 *  total off the list still saves. */
export const WeighIn: Story = {
  parameters: { db: dispatchedDb },
  render: () => form(dispatchedDb, dispatchedDb.lots.at(-1)!.id),
};

/** CHF-07: the Owner's smoke PO is in but Foodiva's Packing List is not. The table starts
 *  with one blank yellow box; set the box count (or "เพิ่มแถว"), weigh each box, save. */
export const NoPackingList: Story = {
  parameters: { db: dispatchDb },
  render: () => form(dispatchDb, dispatchDb.lots.at(-1)!.id),
};

/** "เปิดชุดใหม่": meat at the door with no batch at all (`lotId === ""`). Saving opens a
 *  new batch with its own shipment number (CHF-01). */
export const NewBatch: Story = {
  parameters: { db: smokedDb },
  render: () => form(smokedDb, ""),
};
