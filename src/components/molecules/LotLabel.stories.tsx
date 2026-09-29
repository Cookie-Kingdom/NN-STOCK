import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LotLabel } from "./LotLabel";

const meta = {
  title: "Molecules/LotLabel",
  component: LotLabel,
  argTypes: {
    lotId: {
      control: "text",
      description: 'Clear it (`""`) for the "ไม่ระบุ Lot" bucket.',
    },
  },
  args: { lotId: "LOT-0915-01" },
} satisfies Meta<typeof LotLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** แก้ lotId ใน Controls:
 *  - a batch id: just the id.
 *  - empty: the branch's "ไม่ระบุ Lot" bucket (BR-04), meat received without a batch,
 *    flagged with a "ยังไม่ผูก Lot" badge until someone links it. */
export const Label: Story = {};
