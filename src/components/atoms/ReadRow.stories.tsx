import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "./Panel";
import { ReadRow } from "./ReadRow";

const meta = {
  title: "Atoms/ReadRow",
  component: ReadRow,
  args: { label: "เลขล็อต", value: "LOT-2026-0915-01" },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
  },
} satisfies Meta<typeof ReadRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type `label` / `value` in Controls; a long value wraps and stays right-aligned. */
export const Default: Story = {};

/** A long value wraps and stays right-aligned; the last row drops its divider. */
export const List: Story = {
  argTypes: {
    label: { table: { disable: true } },
    value: { table: { disable: true } },
  },
  render: () => (
    <Panel>
      <ReadRow label="เลขล็อต" value="LOT-2026-0915-01" />
      <ReadRow label="น้ำหนักรับเข้า" value="120.50 กก." />
      <ReadRow label="ต้นทุนรวม" value="฿49,440.00" />
      <ReadRow
        label="หมายเหตุ"
        value="รับเข้าช้ากว่ากำหนด 1 วัน เนื่องจากรถขนส่งเสียระหว่างทาง"
      />
    </Panel>
  ),
};
