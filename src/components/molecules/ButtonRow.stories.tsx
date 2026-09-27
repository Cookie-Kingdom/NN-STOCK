import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Check, Printer, Trash2, X } from "lucide-react";
import { pick } from "../../../.storybook/pick";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "./ButtonRow";

const buttons = pick("children", {
  ฟอร์ม: (
    <>
      <Button variant="primary">บันทึกการรับเข้า</Button>
      <Button variant="secondary">ยกเลิก</Button>
    </>
  ),
  แถวตาราง: (
    <>
      <Button variant="table" icon={<Check />}>
        ยืนยันรับเข้า
      </Button>
      <Button variant="table" icon={<Printer />}>
        พิมพ์ใบส่งของ
      </Button>
      <Button variant="danger" size="sm" icon={<Trash2 />}>
        ลบล็อต
      </Button>
    </>
  ),
  หลายปุ่ม: (
    <>
      <Button variant="primary">ออก PO รมควัน</Button>
      <Button variant="secondary">ส่งให้เชฟ</Button>
      <Button variant="secondary">แก้ไขน้ำหนัก</Button>
      <Button variant="secondary" icon={<X />}>
        ปิดล็อต
      </Button>
    </>
  ),
});

const meta = {
  title: "Molecules/ButtonRow",
  component: ButtonRow,
  args: { children: buttons.initial },
  argTypes: { children: buttons.argType },
} satisfies Meta<typeof ButtonRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls (shown in a `max-w-md` column):
 *  - children ฟอร์ม: the actions under a form, primary first, then the way out
 *  - `compact` (with children แถวตาราง): right-aligns the row and drops the minimum
 *    width — table row actions
 *  - children หลายปุ่ม: many actions wrap onto a second line instead of overflowing
 *    the panel */
export const Default: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  argTypes: { compact: { control: "boolean" } },
  args: { compact: false },
};
