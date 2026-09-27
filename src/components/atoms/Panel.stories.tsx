import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
import { Panel } from "./Panel";
import { ReadRow } from "./ReadRow";
import { Stat } from "./Stat";

const content = pick("children", {
  ข้อมูลล็อต: (
    <>
      <h3>ข้อมูลล็อต</h3>
      <ReadRow label="เลขล็อต" value="LOT-2026-0915-01" />
      <ReadRow label="น้ำหนักรับเข้า" value="120.50 กก." />
      <ReadRow label="หมายเหตุ" value="—" />
    </>
  ),
  ว่าง: (
    <p className="m-0 text-center text-text-secondary">
      ยังไม่มีล็อตในช่วงวันที่เลือก
    </p>
  ),
  "ยอดขาย (มี padding เอง)": (
    <div className="grid gap-2 px-6 py-5.5">
      <h3 className="m-0">ยอดขายรวม</h3>
      <strong className="text-num-lg tabular-nums">฿128,400.00</strong>
    </div>
  ),
});

const meta = {
  title: "Atoms/Panel",
  component: Panel,
  args: { children: content.initial },
  argTypes: { children: content.argType },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick the state in Controls:
 *  - `compact`: tighter padding
 *  - `dashed`: drops the fill too — the outline of a box with nothing in it yet
 *    (pair with children "ว่าง")
 *  - `flush`: hands the padding to the molecule — how KpiCard and ChartPanel use it
 *    (pair with children "ยอดขาย") */
export const Default: Story = {
  argTypes: {
    compact: { control: "boolean" },
    dashed: { control: "boolean" },
    flush: { control: "boolean" },
  },
  args: { compact: false, dashed: false, flush: false },
};

export const Stats: Story = {
  argTypes: { children: { table: { disable: true } } },
  render: () => (
    <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
      <Stat label="คงเหลือ" value="84.20 กก." />
      <Stat label="ต้นทุน/กก." value="฿412.00" />
      <Stat label="Yield" value="68.4%" />
    </div>
  ),
};
