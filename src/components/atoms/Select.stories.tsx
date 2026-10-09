import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select } from "./Select";

const meta = {
  title: "Atoms/Select",
  component: Select,
  args: {
    value: "",
    onChange: () => {},
    options: [
      { value: "", label: "เลือกสาขา" },
      { value: "saladaeng", label: "ศาลาแดง" },
      { value: "minburi", label: "มีนบุรี" },
    ],
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["form", "table", "filter"] },
    disabled: { control: "boolean" },
  },
  // The story holds the value, so picking a row shows on the control.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-72">
        <Select {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `variant`: form (default), table, or filter (compact, for a filter bar)
 *  - `disabled`: cannot be changed
 *
 *  Click it, or focus it and press Enter, Space or an arrow, to open the list. */
export const Default: Story = {
  args: {
    variant: "form",
    disabled: false,
  },
};

/** A choice is made: its label on the control, and a check beside it in the list. */
export const Chosen: Story = {
  args: { value: "minburi" },
};

/** More rows than fit: the list scrolls and opens on the chosen row. Near the bottom of
 *  the window it opens upwards. */
export const LongList: Story = {
  args: {
    value: "14:00",
    options: [
      { value: "", label: "เลือกเวลา" },
      ...Array.from({ length: 24 }, (_, hour) => ({
        value: `${String(hour).padStart(2, "0")}:00`,
      })),
    ],
  },
};

/** In a filter bar: as wide as its text, and the list may be wider than the control. */
export const Filter: Story = {
  args: {
    variant: "filter",
    options: [
      { value: "", label: "ทั้งหมด" },
      { value: "Nerdnuea x LINE MAN" },
      { value: "งานอีเวนต์" },
      { value: "ส่วนกลาง" },
    ],
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <Select {...args} value={value} onChange={setValue} />;
  },
};
