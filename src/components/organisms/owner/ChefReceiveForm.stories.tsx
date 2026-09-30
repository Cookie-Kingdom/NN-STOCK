import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  dispatchDb,
  dispatchedDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { ChefReceiveForm } from "./ChefReceiveForm";

// A native modal <dialog>: a Docs page would stack it, hence `!autodocs`.
const meta: Meta = {
  title: "Organisms/Owner/ChefReceiveForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<{ db: Database }>;

const receiveState = pick("ชุด", {
  "รถมาพร้อม Packing List": dispatchedDb,
  "ไม่มี Packing List": dispatchDb,
  เปิดชุดใหม่: smokedDb,
});

/** Chef House weighs in meat at the door. เลือกชุดใน Controls:
 *  - รถมาพร้อม Packing List: the batch on the truck with its 25 + 25 kg Packing List; the
 *    yellow cells start at 25 marked "ตาม Packing List" (expected), the arrival time at
 *    the current slot. Type e.g. 24.5 in a cell: its marker goes, and a total off the
 *    list still saves.
 *  - ไม่มี Packing List (CHF-07): the Owner's smoke PO is in but Foodiva's Packing List is
 *    not. The table starts with one blank yellow box; set the box count (or "เพิ่มแถว"),
 *    weigh each box, save.
 *  - เปิดชุดใหม่: meat at the door with no batch at all (`lotId === ""`). Saving opens a new
 *    batch with its own shipment number (CHF-01). */
export const Receive: Story = {
  argTypes: { db: receiveState.argType },
  args: { db: receiveState.initial },
  render: ({ db }) => {
    const lotId = db === smokedDb ? "" : db.lots.at(-1)!.id;
    return (
      <ChefReceiveForm
        // key: the form reads its start values once; a new state remounts it.
        key={`${db.entries.length}:${lotId}`}
        db={db}
        lotId={lotId}
        date={day}
        onDate={fn()}
        onClose={fn()}
        onSaved={fn()}
      />
    );
  },
};
