import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "./Panel";
import { ReadRow } from "./ReadRow";
import { Stat } from "./Stat";

const meta = {
  title: "Atoms/Panel",
  component: Panel,
  args: {
    children: (
      <>
        <h3>ข้อมูลล็อต</h3>
        <ReadRow label="เลขล็อต" value="LOT-2026-0915-01" />
        <ReadRow label="น้ำหนักรับเข้า" value="120.50 กก." />
        <ReadRow label="หมายเหตุ" value="—" />
      </>
    ),
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Compact: Story = { args: { compact: true } };

export const Stats: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
      <Stat label="คงเหลือ" value="84.20 กก." />
      <Stat label="ต้นทุน/กก." value="฿412.00" />
      <Stat label="Yield" value="68.4%" />
    </div>
  ),
};
