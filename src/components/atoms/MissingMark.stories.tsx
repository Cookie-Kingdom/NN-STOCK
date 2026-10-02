import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MissingMark } from "./MissingMark";
import { ReadRow } from "./ReadRow";

const meta = {
  title: "Atoms/MissingMark",
  component: MissingMark,
} satisfies Meta<typeof MissingMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A field the note was saved without: yellow, never mistaken for a value. */
export const Default: Story = {};

export const InReadRows: Story = {
  render: () => (
    <div className="max-w-md">
      <ReadRow label="เลข Invoice" value="INV-0921" />
      <ReadRow label="วันที่ Invoice" value={<MissingMark />} />
      <ReadRow
        label="ค่าเนื้อ"
        value={<MissingMark>ยังคิดไม่ได้</MissingMark>}
      />
    </div>
  ),
};
