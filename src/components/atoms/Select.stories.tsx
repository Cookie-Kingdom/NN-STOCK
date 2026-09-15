import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select } from "./Select";

const meta = {
  title: "Atoms/Select",
  component: Select,
  args: {
    children: ["ศาลาแดง", "มีนบุรี"].map((name) => (
      <option key={name}>{name}</option>
    )),
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["form", "table", "filter"] },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {};
export const Filter: Story = { args: { variant: "filter" } };
export const Disabled: Story = { args: { disabled: true } };
