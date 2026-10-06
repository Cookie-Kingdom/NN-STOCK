import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Download } from "lucide-react";
import { pick } from "../../../.storybook/pick";
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
type Props = ComponentProps<typeof ActionWithError>;

const state = pick<Partial<Props>>("สถานะ", {
  ไม่มีข้อผิดพลาด: {},
  มีข้อผิดพลาด: { error: "กรอกจำนวนที่รับจริงก่อน" },
  ข้อความยาว: {
    children: (
      <Button variant="table" icon={<Download className="size-3.5" />}>
        ดาวน์โหลด
      </Button>
    ),
    error: "ไม่พบไฟล์แนบนี้ เพราะอัปโหลดไม่สำเร็จ กรุณาแนบไฟล์ใหม่",
    errorClassName: "max-w-64 text-right whitespace-normal",
  },
});

/** Pick the state in Controls:
 *  - ไม่มีข้อผิดพลาด: only the action shows, right-aligned in its table cell
 *  - มีข้อผิดพลาด: the message sits under the action, so it cannot widen the last
 *    table column
 *  - ข้อความยาว: `errorClassName` lets a long message wrap instead of running off
 *    the row */
export const Default: StoryObj<Props & { state: Partial<Props> }> = {
  argTypes: { state: state.argType },
  args: { state: state.initial },
  render: ({ state, ...args }) => <ActionWithError {...args} {...state} />,
};
