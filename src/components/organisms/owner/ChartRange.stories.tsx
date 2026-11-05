import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "@/components/atoms/Panel";
import { phone } from "@/components/organisms/workspace/storyWorkspace";
import { ChartRange, useChartRange } from "./ChartRange";

function Demo({ from, to, max }: { from: string; to: string; max?: string }) {
  const range = useChartRange(from, to);
  return (
    <Panel>
      <ChartRange range={range} max={max} />
      <p className="mt-3 mb-0 text-caption text-text-secondary">
        {range.from} – {range.to}
      </p>
    </Panel>
  );
}

const meta = {
  title: "Organisms/Owner/ChartRange",
  component: Demo,
  args: { from: "2026-05-01", to: "2026-11-05", max: "2026-11-05" },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ช่วงของกราฟ: ปฏิทิน 「ตั้งแต่」 เลือกเกินวัน 「ถึง」 ไม่ได้ 「ถึง」 ก่อน 「ตั้งแต่」 หรือเกินวันนี้ไม่ได้ ·
 *  เปลี่ยนค่าเริ่มต้น (args) แล้วช่วงกลับไปที่ค่าเริ่มต้นใหม่ เหมือนตอนหน้าเปลี่ยนเดือน */
export const SixMonths: Story = {};

/** ไม่มีเพดาน (หน้า Overview, Finance): 「ถึง」 เลือกเลยวันนี้ได้ ค่าเริ่มต้นจบที่สิ้นเดือน */
export const NoMax: Story = {
  args: { from: "2026-11-01", to: "2026-11-30", max: undefined },
};

/** จอ 390px */
export const Phone: Story = { ...phone };
