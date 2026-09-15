import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta = {
  title: "Atoms/Badge",
  component: Badge,
  args: { children: "รอรับเข้า" },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["neutral", "success", "warning", "danger"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="neutral">รอดำเนินการ</Badge>
      <Badge tone="success">ปิดล็อตแล้ว</Badge>
      <Badge tone="warning">ใกล้หมด</Badge>
      <Badge tone="danger">ติดลบ</Badge>
    </div>
  ),
};
