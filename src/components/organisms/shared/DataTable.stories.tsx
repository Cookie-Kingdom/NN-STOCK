import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import { DataTable } from "./DataTable";

const rows = Array.from({ length: 45 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return [
    <PoLotCell key="lot" poId={`PO-0412-${n}`} lotId={`LOT-0915-${n}`} />,
    `${(80 + i * 1.5).toFixed(2)} กก.`,
    `฿${(320 + i).toFixed(2)}`,
    <Badge key="state" tone={i % 3 === 0 ? "warning" : "success"}>
      {i % 3 === 0 ? "รอรับ" : "รับแล้ว"}
    </Badge>,
  ];
});

const meta = {
  title: "Organisms/DataTable",
  component: DataTable,
  args: {
    title: "ล็อตที่รับเข้า",
    columns: ["PO / ล็อต", "น้ำหนัก", "ราคา/กก.", "สถานะ"],
    rows,
    action: <Button variant="secondary">ส่งออก</Button>,
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paginated: Story = {};
export const SinglePage: Story = { args: { rows: rows.slice(0, 5) } };
export const Empty: Story = { args: { rows: [] } };

/** `defaultSort` picks the starting column; the dropdown lists every text column. */
export const Sorted: Story = {
  args: { defaultSort: { column: "น้ำหนัก", desc: true } },
};

/** `columnWidths` fixes the layout: the columns hold their width as rows are filtered,
 *  long text wraps inside its cell, and a phone pans sideways past the summed width. */
export const FixedColumns: Story = {
  args: {
    columns: ["PO / ล็อต", "น้ำหนัก", "ราคา/กก.", "สถานะ", "รายละเอียด"],
    columnWidths: ["12rem", "8rem", "8rem", "7rem", "18rem"],
    rows: rows
      .slice(0, 6)
      .map((row, i) => [
        ...row,
        i % 2
          ? "รับเข้าสต๊อกกลางแล้ว"
          : "จากรับเข้าสต๊อกกลาง · เก็บที่ Foodiva รอ Owner จัดสรรไปสาขา ข้อความยาวจึงขึ้นบรรทัดใหม่",
      ]),
  },
};

/** One row still shows "เรียงตาม", so the toolbar does not shift as filters change. */
export const SingleRow: Story = {
  args: { rows: rows.slice(0, 1) },
};
