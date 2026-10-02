import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/atoms/Badge";
import { DayCard } from "./DayCard";

const rows = (
  <>
    <p className="border-b border-border px-5 py-3">
      21:10 · ยอดขาย · 25 กล่อง
    </p>
    <p className="px-5 py-3">08:20 · จ่ายเงิน · วัตถุดิบ</p>
  </>
);

const meta = {
  title: "Molecules/DayCard",
  component: DayCard,
  args: {
    title: "วันพฤหัสบดีที่ 1 ต.ค.",
    tone: "ok",
    aside: <Badge tone="success">ศาลาแดง · จดยอดขายแล้ว</Badge>,
    children: rows,
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["ok", "warning"] },
    aside: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof DayCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** วันที่จดครบ: หัวการ์ดสีปกติ ป้ายสีเขียว */
export const Default: Story = {};

/** วันที่ยังมีบันทึกไม่ได้จด: หัวการ์ดสีเหลือง และมีข้อความบอก ไม่ได้บอกด้วยสีอย่างเดียว */
export const Warning: Story = {
  args: {
    title: "วันศุกร์ที่ 2 ต.ค. · วันนี้",
    tone: "warning",
    aside: <Badge tone="warning">ศาลาแดง · ยังไม่ได้จดยอดขาย</Badge>,
  },
};

/** วันที่ยังไม่มีบันทึกเลย: มีแต่หัวการ์ด */
export const NoRows: Story = {
  args: { ...Warning.args, children: undefined },
};
