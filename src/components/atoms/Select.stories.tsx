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
    prefilled: {
      control: "inline-radio",
      options: [undefined, "auto", "expected"],
    },
    reason: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: form (default), table, or filter (compact, for a filter bar)
 *  - `prefilled="auto"`: the system picked the value (faint tint)
 *  - `prefilled="expected"`: a predicted choice to check (warning tint)
 *  - `reason`: the wider, left-aligned look used inside a table row
 *  - `disabled`: locked */
export const Default: Story = {
  args: {
    variant: "form",
    prefilled: undefined,
    reason: false,
    disabled: false,
  },
};
