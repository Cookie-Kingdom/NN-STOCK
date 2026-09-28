import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LotLabel } from "./LotLabel";

const meta = {
  title: "Molecules/LotLabel",
  component: LotLabel,
  args: { lotId: "LOT-0915-01" },
} satisfies Meta<typeof LotLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A batch: just its id. */
export const Batch: Story = {};

/** The branch's "ไม่ระบุ Lot" bucket (`lotId ""`): meat received without a batch,
 *  flagged until someone links it. */
export const Unlinked: Story = { args: { lotId: "" } };
