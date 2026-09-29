import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  args: { children: "รอรับเข้า" },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["neutral", "success", "warning", "danger", "inverse"],
    },
    children: { control: "text" },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick `tone` in Controls: neutral (waiting), success (closed), warning (running
 *  low), danger (negative), inverse (a "saved" confirmation). */
export const Default: Story = { args: { tone: "neutral" } };

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="neutral">รอดำเนินการ</Badge>
      <Badge tone="success">ปิดล็อตแล้ว</Badge>
      <Badge tone="warning">ใกล้หมด</Badge>
      <Badge tone="danger">ติดลบ</Badge>
      <Badge tone="inverse">บันทึกแล้ว</Badge>
    </div>
  ),
};
