import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { PackWeightFields } from "./PackWeightFields";

const meta = {
  title: "Molecules/PackWeightFields",
  component: PackWeightFields,
  tags: ["!autodocs"],
  args: { value: "", onChange: fn() },
} satisfies Meta<typeof PackWeightFields>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The field is controlled by the form, so the story owns the value. */
function Controlled({
  initial,
  onChange,
}: {
  initial: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PackWeightFields
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

/** แก้ `value` ใน Controls (น้ำหนักแต่ละกล่องคั่นด้วย `,`):
 *  - ว่าง: กล่องเดียว ยังไม่กรอก ไม่มีปุ่มลบ สรุป 0 กล่อง
 *  - หลายกล่อง เช่น `12.5,13,12.75`: ทุกแถวมีปุ่มลบ สรุปจำนวนกล่องและน้ำหนักรวม
 *  - มีช่องว่างหรือค่าผิด เช่น `12.5,,-1`: แถวยังอยู่ แต่สรุปนับเฉพาะน้ำหนักที่ใช้ได้ */
export const Default: Story = {
  args: { value: "12.5,13,12.75" },
  render: ({ value, onChange }) => (
    <Controlled key={value} initial={value} onChange={onChange} />
  ),
};
