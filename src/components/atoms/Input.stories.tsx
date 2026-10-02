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

/** Pick the state in Controls:
 *  - `variant`: form (default), table (a table cell, e.g. "12.50"), or filter (e.g.
 *    `type="date"` in a filter bar)
 *  - `type="number"`: ตัวเลขทั่วไป: ไม่มีปุ่มเพิ่ม/ลด และเลื่อนเมาส์แล้วค่าไม่เปลี่ยน
 *  - `spinner`: ใช้ปุ่มเพิ่ม/ลดของเบราว์เซอร์ (with `type="number"`)
 *  - `disabled`: cannot be typed in */
export const Default: Story = {
  argTypes: {
    type: { control: "inline-radio", options: ["text", "number", "date"] },
    spinner: { control: "boolean" },
    disabled: { control: "boolean" },
    defaultValue: { control: "text" },
    step: { control: "text" },
  },
  args: {
    variant: "form",
    type: "text",
    step: "0.01",
    spinner: false,
    disabled: false,
    defaultValue: "",
  },
  // defaultValue only applies on mount, so remount when it or the type changes.
  render: (args) => (
    <Input key={`${args.type}|${String(args.defaultValue)}`} {...args} />
  ),
};
