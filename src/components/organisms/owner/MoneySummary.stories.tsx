import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "@/components/atoms/Panel";
import { phone } from "@/components/organisms/workspace/storyWorkspace";
import { MoneySummary } from "./MoneySummary";

const meta = {
  title: "Organisms/Owner/MoneySummary",
  component: MoneySummary,
  args: {
    period: "พ.ย. 2569",
    carried: 52400,
    received: { amount: 31800, note: "มากกว่าเดือนก่อน 12.5%" },
    paid: { amount: 24650, note: "น้อยกว่าเดือนก่อน 3%" },
    toReceive: { amount: 1850, note: "รอรับ 2 รายการ" },
    toPay: { amount: 127000, note: "PO รอจ่าย 3 รายการ" },
  },
  decorators: [
    (Story) => (
      <Panel>
        <Story />
      </Panel>
    ),
  ],
} satisfies Meta<typeof MoneySummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** การ์ดเงินชุดเดียวของหน้า Accounting และ Finance: ยอดยกมา เงินเข้า เงินออก เงินคงเหลือ
 *  (= ยอดยกมา + เงินเข้า − เงินออก) แล้วยอดที่ยังไม่ได้รับ / ยังไม่ได้จ่าย ณ วันนี้ (สีเหลืองเมื่อมี) */
export const Default: Story = {};

/** เงินออกมากกว่าที่มี: ยอดยกมาและเงินคงเหลือติดลบเป็นสีแดง ไม่มีอะไรค้าง */
export const Negative: Story = {
  args: {
    carried: -8200,
    received: { amount: 0, note: "เดือนก่อนไม่มีเงินเข้า" },
    toReceive: { amount: 0, note: "รอรับ 0 รายการ" },
    toPay: { amount: 0, note: "PO รอจ่าย 0 รายการ" },
  },
};

/** จอ 390px: การ์ดสองใบต่อแถว */
export const Phone: Story = { ...phone };
