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
    reason: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: form (default), table, or filter (compact, for a filter bar)
 *  - `reason`: the wider, left-aligned look used inside a table row
 *  - `disabled`: locked */
export const Default: Story = {
  args: {
    variant: "form",
    reason: false,
    disabled: false,
  },
};
