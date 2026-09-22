import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";

const meta = {
  title: "Atoms/Input",
  component: Input,
  args: { placeholder: "น้ำหนัก (กก.)" },
  argTypes: {
    variant: { control: "inline-radio", options: ["form", "table", "filter"] },
    prefilled: {
      control: "inline-radio",
      options: [undefined, "auto", "expected"],
    },
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
/** A table cell the system filled in (`prefilled="auto"`). */
export const TablePrefilled: Story = {
  args: { variant: "table", prefilled: "auto", defaultValue: "12.50" },
};
/** A predicted scale or count reading to weigh and correct (`prefilled="expected"`). */
export const TablePrefilledExpected: Story = {
  args: { variant: "table", prefilled: "expected", defaultValue: "12.50" },
};
export const FormPrefilled: Story = {
  args: { prefilled: "auto", defaultValue: "สมชาย" },
};
export const FormPrefilledExpected: Story = {
  args: { prefilled: "expected", type: "number", defaultValue: "360" },
};
export const Filter: Story = { args: { variant: "filter", type: "date" } };
export const Disabled: Story = { args: { disabled: true, value: "ล็อก" } };

/** ตัวเลขทั่วไป: ไม่มีปุ่มเพิ่ม/ลด และเลื่อนเมาส์แล้วค่าไม่เปลี่ยน */
export const Number: Story = {
  args: { type: "number", step: "0.01", defaultValue: "12.50" },
};
/** เฉพาะ PackingListTable ที่ยังใช้ปุ่มเพิ่ม/ลดของเบราว์เซอร์ */
export const NumberWithSpinner: Story = {
  args: { type: "number", step: "0.01", defaultValue: "12.50", spinner: true },
};
