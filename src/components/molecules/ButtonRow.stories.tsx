import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Check, Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "./ButtonRow";

const meta = {
  title: "Molecules/ButtonRow",
  component: ButtonRow,
  args: {
    children: (
      <>
        <Button variant="primary">บันทึกการรับเข้า</Button>
        <Button variant="secondary">ยกเลิก</Button>
      </>
    ),
  },
} satisfies Meta<typeof ButtonRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The actions under a form: primary first, then the way out. */
export const FormActions: Story = {};

/** `compact` right-aligns the row and drops the minimum width — table row actions. */
export const Compact: Story = {
  args: {
    compact: true,
    children: (
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
  },
};

/** Many actions wrap onto a second line instead of overflowing the panel. */
export const Wrapping: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    children: (
      <>
        <Button variant="primary">ออก PO รมควัน</Button>
        <Button variant="secondary">ส่งให้เชฟ</Button>
        <Button variant="secondary">แก้ไขน้ำหนัก</Button>
        <Button variant="secondary" icon={<X />}>
          ปิดล็อต
        </Button>
      </>
    ),
  },
};
