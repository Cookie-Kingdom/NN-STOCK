import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChartPanel } from "@/components/molecules/ChartPanel";
import { fmt } from "@/lib/format";
import { CostDonut } from "./CostDonut";
import { SalesBars } from "./SalesBars";

const meta: Meta = {
  title: "Molecules/Charts",
};

export default meta;

/** แก้ `total` ใน Controls:
 *  - ยอดจริง: วงแบ่งตามสัดส่วนของแต่ละส่วน
 *  - 0: สถานะว่าง วงไม่มีสี และทุกส่วนอ่าน 0.00% */
export const Donut: StoryObj<typeof CostDonut> = {
  argTypes: {
    label: { control: "text" },
    total: { control: { type: "number", min: 0, step: 1000 } },
  },
  args: {
    label: "ต้นทุนล็อต LOT-0915-01",
    total: 48250,
    parts: [
      { label: "เนื้อดิบ", value: 38400, color: "var(--color-chart-1)" },
      { label: "ค่ารมควัน", value: 6200, color: "var(--color-chart-2)" },
      { label: "ค่าขนส่ง", value: 2150, color: "var(--color-chart-3)" },
      { label: "บรรจุภัณฑ์", value: 1500, color: "var(--color-chart-4)" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
  render: (args) => <CostDonut {...args} />,
};

type BarsArgs = {
  branch: "sala" | "minburi";
  colorClass: string;
  max: number;
  days: number;
};

const sales = (days: number) =>
  Array.from({ length: days }, (_, i) => ({
    date: `2026-09-${String(9 + i).padStart(2, "0")}`,
    sala: 18000 + ((i * 3700) % 14000),
    minburi: 12000 + ((i * 5100) % 16000),
  }));

/** เลือกใน Controls:
 *  - `branch`: แท่งอ่านยอดของสาขาไหน (ศาลาแดง / มีนบุรี) ตามที่หน้า Dashboard แสดงสองกราฟ
 *  - `colorClass`: `sala` ส้ม, `minburi` เขียว หรือ class Tailwind อื่นก็ได้
 *  - `max`: ยอดบนสุดของแกน ตั้งต่ำกว่ายอดจริงเพื่อดูแท่งเต็มกรอบ
 *  - `days`: จำนวนวัน ยิ่งมากกราฟยิ่งเลื่อนแนวนอน */
export const Bars: StoryObj<BarsArgs> = {
  argTypes: {
    branch: { control: "inline-radio", options: ["sala", "minburi"] },
    colorClass: {
      control: "select",
      options: ["sala", "minburi", "bg-danger"],
    },
    max: { control: { type: "number", min: 1000, step: 5000 } },
    days: { control: { type: "range", min: 1, max: 20 } },
  },
  args: { branch: "sala", colorClass: "sala", max: 35000, days: 7 },
  decorators: [
    (Story) => (
      <div className="w-[48rem] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: ({ branch, colorClass, max, days }) => {
    const data = sales(days);
    const total = data.reduce((sum, item) => sum + item[branch], 0);
    return (
      <ChartPanel
        overline={`${days} วันล่าสุด`}
        title={branch === "sala" ? "ศาลาแดง" : "มีนบุรี"}
        total={`฿${fmt(total)}`}
        totalTone={branch === "sala" ? "warning" : "accent"}
      >
        <SalesBars
          data={data}
          branch={branch}
          colorClass={colorClass}
          max={max}
        />
      </ChartPanel>
    );
  },
};
