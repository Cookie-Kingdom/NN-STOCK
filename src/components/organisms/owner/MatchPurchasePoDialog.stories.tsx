import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { unmatchedPoDb } from "../../../../.storybook/fixtures";
import { MatchPurchasePoDialog } from "./MatchPurchasePoDialog";

// A native modal <dialog>; a Docs page would stack the stories.
const meta: Meta = {
  title: "Organisms/Owner/MatchPurchasePoDialog",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: unmatchedPoDb },
};

export default meta;
type Story = StoryObj;

/** "จับคู่ PO ซื้อ" from central receive (RET-07): the smoke PO's own edit (SMK-05) for a
 *  batch saved without purchase PO lines. The 100 kg invoiced PO is listed with its kg left;
 *  type the kg this batch drew, the reason is already filled, and "บันทึกการแก้ไข" saves an
 *  `entryEdit`. */
export const Match: Story = {
  render: () => (
    <MatchPurchasePoDialog
      db={unmatchedPoDb}
      lotId={unmatchedPoDb.lots.find((lot) => lot.kind === "shipment")!.id}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};

/** A batch with no smoke PO: nothing to edit, the dialog says where to issue one. */
export const NoSmokePo: Story = {
  render: () => (
    <MatchPurchasePoDialog
      db={unmatchedPoDb}
      lotId={unmatchedPoDb.lots.at(-1)!.id}
      onClose={fn()}
      onSaved={fn()}
    />
  ),
};
