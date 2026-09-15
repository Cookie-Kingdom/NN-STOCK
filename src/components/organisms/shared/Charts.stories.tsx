import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChartPanel } from "@/components/molecules/ChartPanel";
import { CostDonut } from "./CostDonut";
import { SalesBars } from "./SalesBars";

const meta = {
  title: "Organisms/Charts",
  component: CostDonut,
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
} satisfies Meta<typeof CostDonut>;

export default meta;
type Story = StoryObj<typeof meta>;

const narrow: Story["decorators"] = [
  (Story) => (
    <div className="max-w-xs">
      <Story />
    </div>
  ),
];

export const Donut: Story = { decorators: narrow };
export const DonutEmpty: Story = { args: { total: 0 }, decorators: narrow };

const sales = Array.from({ length: 7 }, (_, i) => ({
  date: `2026-09-${String(9 + i).padStart(2, "0")}`,
  sala: 18000 + ((i * 3700) % 14000),
  minburi: 12000 + ((i * 5100) % 16000),
}));

export const Bars: Story = {
  decorators: [
    (Story) => (
      <div className="w-[48rem] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid gap-4">
      <ChartPanel overline="7 วันล่าสุด" title="ศาลาแดง" total="฿168,300">
        <SalesBars data={sales} branch="sala" colorClass="sala" max={35000} />
      </ChartPanel>
      <ChartPanel
        overline="7 วันล่าสุด"
        title="มีนบุรี"
        total="฿142,700"
        totalTone="accent"
      >
        <SalesBars
          data={sales}
          branch="minburi"
          colorClass="minburi"
          max={35000}
        />
      </ChartPanel>
    </div>
  ),
};
