import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "./ButtonRow";
import { PoLotCell } from "./PoLotCell";
import { ReferenceCard } from "./ReferenceCard";

const meta = {
  title: "Molecules/ReferenceCard",
  component: ReferenceCard,
  args: {
    title: "ใบสั่งซื้อ",
    number: "PO-2026-0412",
    rows: [
      ["ผู้ขาย", "Foodiva"],
      ["น้ำหนักสั่ง", "120.00 กก."],
      ["ราคา/กก.", "฿320.00"],
      ["หมายเหตุ", ""],
    ],
    action: <Button variant="table">ดูเอกสาร</Button>,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReferenceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Without `number` the heading is the plain title — how the pre-save preview of a
 *  form's own values uses the card. */
export const WithoutNumber: Story = {
  args: {
    title: "ตรวจสอบก่อนบันทึก",
    number: undefined,
    action: undefined,
    rows: [
      ["น้ำหนักรับจริง", "118.40 กก."],
      ["ส่วนต่างจากที่สั่ง", "1.60 กก."],
      ["มูลค่ารวม", "฿37,888.00"],
    ],
  },
};

export const PoLot: Story = {
  render: () => (
    <div className="flex gap-10">
      <PoLotCell poId="PO-2026-0412" lotId="LOT-0915-01" sub="ศาลาแดง" />
      <PoLotCell lotId="LOT-0915-02" />
    </div>
  ),
};

export const Buttons: Story = {
  render: () => (
    <div className="grid gap-4">
      <ButtonRow>
        <Button variant="primary">บันทึก</Button>
        <Button>ยกเลิก</Button>
      </ButtonRow>
      <ButtonRow compact>
        <Button variant="table">แก้ไข</Button>
        <Button variant="table">ลบ</Button>
      </ButtonRow>
    </div>
  ),
};
