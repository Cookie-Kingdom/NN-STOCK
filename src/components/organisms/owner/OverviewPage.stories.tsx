import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { seed } from "@/lib/store";
import { OverviewPage } from "./OverviewPage";

const Overview = () => (
  <WithWorkspace>{(ws) => <OverviewPage ws={ws} />}</WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/OverviewPage",
  component: Overview,
  parameters: { db: sampleDb },
} satisfies Meta<typeof Overview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: รายได้รวมของร้าน สลับดูรายเดือนหรือรายปี · กราฟแท่งต่อวัน (ต่อเดือนในมุมมองปี)
 *  ตัวเลขของช่วง แต่ละ Project จากรายได้ถึงกำไร สาขา ช่องทางขาย แล้วตามด้วย P&L
 *  · ไม่มีกล่องยังไม่ได้จด (รายการนั้นอยู่ที่กระดิ่งและ Daily Log) */
export const Owner: Story = {};

/** ยังไม่มีบันทึก: กราฟว่าง ย้อนเดือนไม่ได้ ต้นทุนต่อกล่องยังไม่มี Lot ที่จดครบ */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: คอลัมน์เดียว */
export const Phone: Story = { ...phone };
