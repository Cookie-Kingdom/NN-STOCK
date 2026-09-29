import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import { pick } from "../../../.storybook/pick";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { TableSection } from "./TableSection";

const body = (
  <div className="px-6 py-5 text-body text-text-secondary">
    เนื้อหาของการ์ด เช่น ตาราง ฟอร์ม หรือสรุปยอด
  </div>
);

const meta = {
  title: "Molecules/TableSection",
  component: TableSection,
  args: { title: "ทะเบียนเอกสารตาม Lot", children: body },
} satisfies Meta<typeof TableSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const actions = pick("ปุ่มบนแถบหัว", {
  มีปุ่ม: (
    <div className="flex flex-wrap items-center gap-3 max-md:justify-between">
      <Button variant="secondary" size="sm">
        ส่งออก
      </Button>
      <Button size="sm">เพิ่มรายการ</Button>
    </div>
  ),
  ไม่มี: undefined,
});

/** เลือกใน Controls:
 *  - `count`: ข้อความจาง ๆ ข้างชื่อ ทุกตารางบอกจำนวนแถว (ลบให้ว่างเพื่อดูแบบมีแต่ชื่อ)
 *  - ปุ่มบนแถบหัว: `actions` อยู่ทางขวาของแถบหัว และลงไปอยู่ใต้ชื่อเมื่อจอเล็กกว่า md */
export const WithActions: Story = {
  argTypes: { actions: actions.argType },
  args: { count: "12 รายการ", actions: actions.initial },
};

const rows = Array.from({ length: 6 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return [
    <PoLotCell key="lot" poId={`PO-0412-${n}`} lotId={`LOT-0915-${n}`} />,
    "2026-09-09",
    `${(80 + i * 1.5).toFixed(2)} กก.`,
    <Badge key="state" tone={i % 3 === 0 ? "warning" : "success"}>
      {i % 3 === 0 ? "รอรับ" : "รับแล้ว"}
    </Badge>,
  ];
});

/** How the app really uses it: `DataTable` builds a `TableSection` around the table
 * and fills the title bar with the row count and the sort control. */
export const WithTable: Story = {
  render: () => (
    <DataTable
      title="ล็อตที่รับเข้า"
      columns={["PO / ล็อต", "วันที่", "น้ำหนัก", "สถานะ"]}
      rows={rows}
      action={<Button variant="secondary">ส่งออก</Button>}
    />
  ),
};
