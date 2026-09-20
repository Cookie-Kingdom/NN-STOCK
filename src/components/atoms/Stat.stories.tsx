import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Stat } from "./Stat";

const meta = {
  title: "Atoms/Stat",
  component: Stat,
  args: { label: "คงเหลือ", value: "84.20 กก." },
} satisfies Meta<typeof Stat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Row: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
      <Stat label="คงเหลือ" value="84.20 กก." />
      <Stat label="ต้นทุน/กก." value="฿412.00" />
      <Stat label="Yield" value="68.4%" />
    </div>
  ),
};
