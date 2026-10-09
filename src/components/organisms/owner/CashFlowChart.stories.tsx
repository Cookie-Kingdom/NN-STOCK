import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "@/components/atoms/Panel";
import { phone } from "@/components/organisms/workspace/storyWorkspace";
import { CashFlowChart, type FlowBar } from "./CashFlowChart";

const names = "พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค.".split(" ");
/** Six months, each with more in than out. */
const months: FlowBar[] = names.map((label, i) => ({
  label,
  title: label,
  in: 310000 + i * 38000,
  out: 240000 + ((i * 5) % 4) * 31000,
}));

const meta = {
  title: "Organisms/Owner/CashFlowChart",
  component: CashFlowChart,
  args: {
    label: "กราฟแท่งเงินเข้า–ออกต่อเดือน",
    unit: "เดือน",
    bars: months,
  },
  decorators: [
    (Story) => (
      <Panel>
        <Story />
      </Panel>
    ),
  ],
} satisfies Meta<typeof CashFlowChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** หกเดือน: แท่งซ้ายเขียวคือเงินเข้า แท่งขวาแดงคือเงินออก เส้นคือสุทธิ · ชี้ที่เดือนหรือกดลูกศร
 *  ซ้ายขวาเพื่อดูตัวเลข · "ดูเป็นตาราง" มีตัวเลขทุกเดือน */
export const Months: Story = {};

/** เดือนที่เงินออกมากกว่าเงินเข้า: เส้นสุทธิลงใต้ศูนย์ แกนมีค่าติดลบ ตัวเลขสุทธิเป็นสีแดงมีเครื่องหมายลบ */
export const NegativeNet: Story = {
  args: {
    bars: months.map((bar, i) =>
      i === 2 ? { ...bar, in: 60000, out: 420000 } : bar,
    ),
  },
};

/** ยังไม่มีเงินเข้า–ออกในช่วงนี้: ไม่มีแท่งและไม่มีเส้น */
export const Empty: Story = {
  args: { bars: months.map((bar) => ({ ...bar, in: 0, out: 0 })) },
};

/** จอ 390px */
export const Phone: Story = { ...phone };
