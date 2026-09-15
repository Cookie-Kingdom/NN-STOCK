import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";

const meta = {
  title: "Atoms/Input",
  component: Input,
  args: { placeholder: "น้ำหนัก (กก.)" },
  argTypes: {
    variant: { control: "inline-radio", options: ["form", "table", "filter"] },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {};
export const Table: Story = {
  args: { variant: "table", defaultValue: "12.50" },
};
export const TableReason: Story = {
  args: { variant: "table", reason: true, placeholder: "เหตุผล" },
};
export const Filter: Story = { args: { variant: "filter", type: "date" } };
export const Disabled: Story = { args: { disabled: true, value: "ล็อก" } };
