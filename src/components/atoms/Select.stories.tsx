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
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: form (default), table, or filter (compact, for a filter bar)
 *  - `disabled`: cannot be changed */
export const Default: Story = {
  args: {
    variant: "form",
    disabled: false,
  },
};
