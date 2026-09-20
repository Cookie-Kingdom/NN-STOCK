import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Download } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { ActionWithError } from "./ActionWithError";

const meta = {
  title: "Molecules/ActionWithError",
  component: ActionWithError,
  args: {
    children: <Button variant="table">ยืนยันรับ</Button>,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionWithError>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Without an error only the action shows, right-aligned in its table cell. */
export const Default: Story = {};

/** The message sits under the action, so it cannot widen the last table column. */
export const WithError: Story = {
  args: { error: "กรอกจำนวนที่รับจริงก่อน" },
};

/** `errorClassName` lets a long message wrap instead of running off the row. */
export const WrappingError: Story = {
  args: {
    children: (
      <Button variant="table" icon={<Download className="size-3.5" />}>
        ดาวน์โหลด
      </Button>
    ),
    error:
      "ไม่พบไฟล์แนบในระบบ: ไฟล์นี้อัปโหลดไม่สำเร็จ กรุณาให้ผู้ส่งแนบไฟล์ใหม่",
    errorClassName: "max-w-64 text-right whitespace-normal",
  },
};
