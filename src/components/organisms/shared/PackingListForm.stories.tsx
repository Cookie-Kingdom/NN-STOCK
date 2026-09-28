import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  dispatchDb,
  packedDb,
  packedThenOrderedDb,
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

/** Editing a saved list from the "ชุดรมควัน" row of a batch Foodiva opened, before any
 *  smoke PO: no Inv. Weight, so Sliced Weight Lost stays 0.00. */
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

/** The same list after the Owner issued the smoke PO on this batch (SHP-02): still
 *  editable, with a warning to have the Owner re-check the PO's kg. Inv. Weight is now the
 *  PO's 50 kg. */
export const AfterSmokeOrder: Story = {
  parameters: { db: packedThenOrderedDb },
  render: () => (
    <PackingListForm
      db={packedThenOrderedDb}
      lotId={packedThenOrderedDb.lots.at(-1)!.id}
      date={day}
      onDate={fn()}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};
