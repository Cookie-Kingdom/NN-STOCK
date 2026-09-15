import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import { FormError } from "./FormError";
import { Notice } from "./Notice";

const meta = {
  title: "Molecules/Notice",
  component: Notice,
  args: { children: "บันทึกรับเนื้อเข้าเรียบร้อยแล้ว" },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["info", "success", "warning", "danger"],
    },
  },
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = { args: { children: "ยังไม่มีการตั้งค่าสาขา" } };
export const Success: Story = { args: { tone: "success" } };
export const Warning: Story = {
  args: { tone: "warning", children: "สต๊อกกลางเหลือน้อยกว่า 10 กก." },
};
export const Danger: Story = {
  args: { tone: "danger", children: "บันทึกไม่สำเร็จ กรุณาลองใหม่" },
};
export const Dismissible: Story = {
  args: { tone: "success", onDismiss: fn() },
};
export const WithAction: Story = {
  args: {
    children: "เริ่มต้นใช้งานด้วยการตั้งค่าราคาเนื้อ",
    action: <Button variant="primary">ไปที่ตั้งค่า</Button>,
  },
};

export const FormErrorMessage: Story = {
  render: () => <FormError error="กรุณากรอกน้ำหนักให้มากกว่า 0" />,
};
