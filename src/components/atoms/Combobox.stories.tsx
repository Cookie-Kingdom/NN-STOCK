import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Combobox } from "./Combobox";

const meta = {
  title: "Atoms/Combobox",
  component: Combobox,
  args: {
    value: "",
    onChange: () => {},
    placeholder: "พิมพ์หรือเลือกผู้ขาย",
    options: [
      { value: "Foodiva" },
      { value: "Chef House" },
      { value: "ร้านข้าวสารเจริญ" },
      { value: "ร้านเครื่องเทศเจ๊หมวย" },
      { value: "ร้านบรรจุภัณฑ์ไทย" },
    ],
  },
  argTypes: {
    disabled: { control: "boolean" },
  },
  // The story holds the text, so typing and picking show on the control.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-72">
        <Combobox {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click it to list every suggestion, or type: the list narrows to the suggestions that
 *  hold the typed text (try "ร้าน"). Text that matches none stands as typed. */
export const Default: Story = {
  args: { disabled: false },
};

/** Holding a suggestion: a click lists them all again, with a check beside this one. */
export const Chosen: Story = {
  args: { value: "Chef House" },
};

/** A suggestion with a `label` of its own (a SKU): shown beside the text, and typing it
 *  finds the row (try "0012"). */
export const WithLabels: Story = {
  args: {
    placeholder: "พิมพ์หรือเลือกรายการ",
    options: [
      { value: "ถุงซีลเนื้อ", label: "SKU-0011" },
      { value: "หมึกพิมพ์", label: "SKU-0012" },
      { value: "กล่องอินฟลูเอนเซอร์", label: "SKU-0013" },
    ],
  },
};
