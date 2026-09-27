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
import { PackingListForm } from "./PackingListForm";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Develop/PackingListForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: dispatchDb },
};

export default meta;
type Story = StoryObj<{ db: Database }>;

const request = pick("Request", {
  ครั้งแรก: dispatchDb,
  ครั้งถัดไป: repeatDispatchDb,
});

/** Inside Foodiva's transport form: seeded from the Request's POs, handed back as a draft.
 *  Invoice and product carry their source. None of the three weights is a field: Sliced
 *  Weight Net is the box rows added up, and Sliced Weight Lost is the gap between Inv.
 *  Weight and it. เลือก Request ใน Controls:
 *  - ครั้งแรก: Inv. Weight is the 50 kg this Request asks of its purchase PO
 *  - ครั้งถัดไป: a later Request of the same product; the CODE comes from the last Packing
 *    List ("ล่าสุด 09/09"), and Inv. Weight follows this Request — 40 kg, not the first
 *    trip's 50 */
export const Draft: Story = {
  argTypes: { db: request.argType },
  args: { db: request.initial },
  render: ({ db }) => (
    <PackingListForm
      key={db.entries.length}
      db={db}
      lotId={db.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onDraft={fn()}
    />
  ),
};

/** Editing a saved list from the "Request เข้า" row, before the Owner's smoke PO: the
 *  saved rows add back up to 50 kg, so Sliced Weight Lost is 0.00. */
export const Edit: Story = {
  parameters: { db: packedDb },
  render: () => (
    <PackingListForm
      db={packedDb}
      lotId={packedDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};
