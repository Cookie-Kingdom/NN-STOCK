import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Pencil, X } from "lucide-react";
import { fn } from "storybook/test";
import { IconButton } from "./IconButton";

const meta = {
  title: "Atoms/IconButton",
  component: IconButton,
  args: { label: "ปิด", icon: <X size={18} />, onClick: fn() },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};
export const Small: Story = {
  args: { size: "sm", label: "แก้ไข", icon: <Pencil size={16} /> },
};
export const Disabled: Story = { args: { disabled: true } };
