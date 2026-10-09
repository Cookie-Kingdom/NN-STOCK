import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "@/components/atoms/Panel";
import { phone } from "@/components/organisms/workspace/storyWorkspace";
import { RevenueChart, type ChartBar } from "./RevenueChart";

/** A month of days up to the 24th: weekends sell more, the month before a little less. */
const days: ChartBar[] = Array.from({ length: 31 }, (_, i) => {
  const value = 14000 + ((i * 37) % 9) * 900 + (i % 7 > 4 ? 5200 : 0);
  return {
    label: String(i + 1),
    title: `${i + 1} ตุลาคม`,
    value: i < 24 ? value : null,
    mark: i < 24 && i < 30 ? value * (0.82 + (i % 4) * 0.07) : null,
  };
});

const names = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.";
/** A year of months up to October: the first two months lose money. */
const months: ChartBar[] = names.split(" ").map((label, i) => ({
  label,
  title: label,
  value: i < 10 ? 180000 + i * 42000 : null,
  mark: i < 10 ? -60000 + i * 31000 : null,
}));

const meta = {
  title: "Organisms/Owner/RevenueChart",
  component: RevenueChart,
  args: {
    label: "กราฟแท่งรายได้ต่อวัน",
    unit: "วันที่",
    bars: days,
    name: "รายได้รวม",
    markName: "วันเดียวกันของกันยายน 2569",
    markAs: "tick",
  },
  decorators: [
    (Story) => (
      <Panel>
        <Story />
      </Panel>
    ),
  ],
} satisfies Meta<typeof RevenueChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** เดือน: แท่งต่อวัน ขีดดำคือวันเดียวกันของเดือนก่อน · ชี้ที่แท่งหรือกดลูกศรซ้ายขวาเพื่อดูตัวเลข */
export const Month: Story = {};

/** ปี: แท่งต่อเดือน เส้นคือกำไรจากการดำเนินงาน ซึ่งติดลบได้ (แกนเดียวกัน หน่วยบาท) */
export const Year: Story = {
  args: {
    label: "กราฟแท่งรายได้ต่อเดือน",
    unit: "เดือน",
    bars: months,
    markName: "กำไรจากการดำเนินงาน",
    markAs: "line",
  },
};

/** มีรายได้อื่นบางวัน: ส่วนบนของแท่งเป็นสีอ่อน มีชื่อในคำอธิบายสี ในกล่องตัวเลขของแท่งนั้น
 *  (รายได้รวม ยอดขาย รายได้อื่น) และเป็นคอลัมน์ในตาราง · วันที่ไม่มีเป็นแท่งสีเดียวเหมือนเดิม */
export const OtherIncome: Story = {
  args: {
    baseName: "ยอดขาย",
    partName: "รายได้อื่น",
    bars: days.map((bar, i) =>
      bar.value !== null && [5, 14, 17].includes(i)
        ? { ...bar, value: bar.value + 9000, part: 9000 }
        : bar,
    ),
  },
};

/** ยังไม่มีรายได้ในช่วงนี้ */
export const Empty: Story = {
  args: { bars: days.map((bar) => ({ ...bar, value: null, mark: null })) },
};

/** จอ 390px: เลขวันแสดงทุก 5 วัน */
export const Phone: Story = { ...phone };
