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
