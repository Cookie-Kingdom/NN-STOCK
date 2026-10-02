import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { PageHeading } from "./PageHeading";

const meta = {
  title: "Molecules/PageHeading",
  component: PageHeading,
  args: {
    title: "Daily Log",
    description: "บันทึกทั้งหมด เรียงตามวัน",
    action: (
      <Button variant="primary" icon={<Plus />}>
        จดบันทึก
      </Button>
    ),
  },
} satisfies Meta<typeof PageHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `title` / `description`: แก้ได้ใน Controls · ปุ่มหลักอยู่ขวา และลงมาอยู่ใต้ข้อความเมื่อจอแคบ */
export const Default: Story = {
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
    action: { control: false },
  },
};

/** หน้า Settings ไม่มีปุ่มจดบันทึก */
export const NoAction: Story = {
  args: {
    title: "Settings",
    description: "ค่าที่เว็บใช้คิด และข้อมูลหัวเอกสาร",
    action: undefined,
  },
};
