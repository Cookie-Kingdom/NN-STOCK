import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import { DataTable } from "./DataTable";
import { TableSection } from "./TableSection";

const body = (
  <div className="px-6 py-5 text-body text-text-secondary">
    เนื้อหาของการ์ด เช่น ตาราง ฟอร์ม หรือสรุปยอด
  </div>
);

const meta = {
  title: "Organisms/TableSection",
  component: TableSection,
  args: { title: "ทะเบียนเอกสารตาม Lot", children: body },
} satisfies Meta<typeof TableSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

/** `count` is the muted text beside the title — every table states its row count. */
export const WithCount: Story = { args: { count: "12 รายการ" } };

/** `actions` fill the right of the title bar and stack under the title below md. */
export const WithActions: Story = {
  args: {
    count: "12 รายการ",
    actions: (
      <div className="flex flex-wrap items-center gap-3 max-md:justify-between">
        <Button variant="secondary" size="sm">
          ส่งออก
        </Button>
        <Button size="sm">เพิ่มรายการ</Button>
      </div>
    ),
  },
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
