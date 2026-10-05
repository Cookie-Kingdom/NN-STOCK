import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { seed } from "@/lib/store";
import { OverviewPage, ProjectOverviewPage } from "./OverviewPage";

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
 *  · ไม่มีกล่องยังไม่ได้จด (รายการนั้นอยู่ที่กระดิ่งและ Daily Log)
 *  · กล่องที่ขายบอกรายได้ต่อกล่อง ต้นทุนต่อกล่องบอกกำไรต่อกล่อง (ก่อนหัก GP และค่าใช้จ่าย)
 *  กับต้นทุนเป็น % ของราคาขาย */
export const Owner: Story = {};

/** ยังไม่มีบันทึก: กราฟว่าง ย้อนเดือนไม่ได้ ต้นทุนต่อกล่องยังไม่มี Lot ที่จดครบ
 *  (ไม่มีบรรทัดกำไรต่อกล่อง) · ไม่มีกล่องที่ขาย: รายได้ต่อกล่องเป็น — */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: คอลัมน์เดียว */
export const Phone: Story = { ...phone };

/** Overview ของ Project (ใต้หัวข้อ Project ในเมนู): หน้าเดียวกัน มีชื่อ Project ที่รายได้รวม
 *  ไม่มีตารางแต่ละ Project */
export const Project: Story = {
  render: () => (
    <WithWorkspace>{(ws) => <ProjectOverviewPage ws={ws} />}</WithWorkspace>
  ),
};
