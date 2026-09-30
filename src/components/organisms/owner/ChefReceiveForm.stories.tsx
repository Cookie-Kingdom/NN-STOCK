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
 *  - รถมาพร้อม Packing List: the batch on the truck with its Packing List (file, 2 boxes,
 *    50 kg sent) shown for reference; the arrival time starts at the current slot. Type
 *    the received total, e.g. 49: a total off the list is warned about and still saves.
 *    Left blank it saves too, marked "ยังไม่ได้กรอก".
 *  - ไม่มี Packing List (CHF-07): the Owner's smoke PO is in but Foodiva's Packing List is
 *    not. Type the received total and save.
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
