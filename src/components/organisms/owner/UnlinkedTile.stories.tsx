import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { demoDb, linkedDb, unlinkedDb } from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { UnlinkedTile } from "./UnlinkedTile";

const meta: Meta = { title: "Organisms/Owner/UnlinkedTile" };

export default meta;

const state = pick("สถานะ", {
  ผูกครบ: demoDb,
  ยังไม่ผูก: unlinkedDb,
  ผูกเนื้อแล้ว: linkedDb,
});

/** DASH-01, the "ยังไม่ผูก" tile on the dashboard. เลือกสถานะใน Controls:
 *  - ผูกครบ: the demo run; every figure is 0 with its "ครบ" caption.
 *  - ยังไม่ผูก: ศาลาแดง 10 kg with no lot, 1 batch
 *    with no smoke PO, 1 purchase PO with no Foodiva invoice.
 *  - ผูกเนื้อแล้ว: the same after ศาลาแดง linked its meat; the meat figure reads 0. */
export const Tile: StoryObj<{ db: Database }> = {
  argTypes: { db: state.argType },
  args: { db: state.initial },
  render: ({ db }) => <UnlinkedTile db={db} />,
};
