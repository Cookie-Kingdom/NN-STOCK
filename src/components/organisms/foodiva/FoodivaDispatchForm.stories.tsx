import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  dispatchDb,
  packedDb,
  repeatDispatchDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { FoodivaDispatchForm } from "./FoodivaDispatchForm";

// Two native modal <dialog>s can stack here (the Packing List opens on top of the
// transport form); a Docs page would try to show them all at once.
const meta: Meta = {
  title: "Organisms/Foodiva/FoodivaDispatchForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: dispatchDb },
};

export default meta;
type Story = StoryObj<{ db: Database }>;

const tripState = pick("เที่ยวรถ", {
  เที่ยวแรก: dispatchDb,
  มีเวลารถรับล่าสุด: packedDb,
  เที่ยวที่สอง: repeatDispatchDb,
});

/** Foodiva's transport document for the latest smoke PO. เลือกเที่ยวรถใน Controls:
 *  - เที่ยวแรก: the Owner's 50 kg smoke PO, waiting for Foodiva's transport document. Save
 *    stays off until the Packing List is filled in the dialog on top. "เวลารถรับ" starts
 *    on the next half-hour slot but takes any minute (e.g. 08:15).
 *  - มีเวลารถรับล่าสุด: a database that already has a trip; its pickup time shows as a
 *    one-click shortcut.
 *  - เที่ยวที่สอง: trip, vehicle, plate and driver start from the last transport
 *    document, each captioned with its date ("ล่าสุด 09/09"). Editing one drops its
 *    caption. */
export const New: Story = {
  argTypes: { db: tripState.argType },
  args: { db: tripState.initial },
  render: ({ db }) => (
    <FoodivaDispatchForm
      role="owner"
      db={db}
      lotId={db.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

/** "เปิดชุดใหม่" from the ชุดรมควัน table (`lotId === ""`): no smoke PO, so no PO table and
 *  no Inv. Weight. "น้ำหนักที่ส่ง" may stay blank (the Packing List's Sliced Weight Net is
 *  used); saving opens the batch, and the Owner can issue its smoke PO later. */
export const NewBatch: Story = {
  parameters: { db: packedDb },
  render: () => (
    <FoodivaDispatchForm
      role="owner"
      db={packedDb}
      lotId=""
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};
