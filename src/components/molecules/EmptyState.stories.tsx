import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CircleCheck } from "lucide-react";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Molecules/EmptyState",
  component: EmptyState,
  args: { text: "ยังไม่มีล็อตในระบบ" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Compact: Story = {
  args: {
    compact: true,
    text: "ไม่มีงานค้าง",
    icon: <CircleCheck size={16} />,
  },
};
