import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Stat } from "./Stat";

const meta = {
  title: "Atoms/Stat",
  component: Stat,
  args: { label: "คงเหลือ", value: "84.20 กก." },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
  },
} satisfies Meta<typeof Stat>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type `label` / `value` in Controls; a long value wraps instead of overflowing. */
export const Default: Story = {};

export const Row: Story = {
  argTypes: {
    label: { table: { disable: true } },
    value: { table: { disable: true } },
  },
  render: () => (
    <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
      <Stat label="คงเหลือ" value="84.20 กก." />
      <Stat label="ต้นทุน/กก." value="฿412.00" />
      <Stat label="Yield" value="68.4%" />
    </div>
  ),
};
