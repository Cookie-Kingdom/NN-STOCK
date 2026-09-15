import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bell } from "lucide-react";
import { CountPill } from "./CountPill";

const meta = {
  title: "Atoms/CountPill",
  component: CountPill,
  args: { children: 3 },
} satisfies Meta<typeof CountPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Menu: Story = {
  render: (args) => (
    <div className="flex w-56 items-center gap-2 rounded-md border border-border p-3">
      สต๊อกกลาง
      <CountPill {...args} variant="menu" />
    </div>
  ),
};

export const Overlay: Story = {
  render: (args) => (
    <span className="relative grid size-11 place-items-center rounded-md border border-border">
      <Bell size={19} />
      <CountPill {...args} variant="overlay" />
    </span>
  ),
};

export const Task: Story = {
  args: { variant: "task", children: "ค้าง 2 งาน" },
};
