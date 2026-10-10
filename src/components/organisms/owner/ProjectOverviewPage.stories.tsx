import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { seed } from "@/lib/store";
import { today } from "@/lib/format";
import { legacyDb } from "../../../../.storybook/fixtures";
import { ProjectOverviewPage } from "./ProjectOverviewPage";

const Overview = () => (
  <WithWorkspace>{(ws) => <ProjectOverviewPage ws={ws} />}</WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/ProjectOverviewPage",
  component: Overview,
  parameters: { db: sampleDb },
} satisfies Meta<typeof Overview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Overview ของ Project (ใต้หัวข้อ Project ในเมนู) เป็นหน้าของตัวเอง แยกจาก Overview ของร้าน:
 *  รายได้รวมของ Project (ยอดขาย + รายได้อื่น มีบรรทัดแยกสองยอดใต้ตัวเลขใหญ่) มีชื่อ Project
 *  ที่รายได้รวม · รายได้อื่นนับเฉพาะของ Project (ไม่มีดอกเบี้ยรับของส่วนกลาง)
 *  สลับดูรายเดือนหรือรายปี · กราฟแท่งต่อวัน (ต่อเดือนในมุมมองปี) ส่วนบนสีอ่อนของแท่งคือรายได้อื่น
 *  ตัวเลขของช่วง (การ์ด 5 ช่อง) จากรายได้ถึงกำไร (ยอดขาย ต่อด้วยรายได้อื่น แล้วหักลงมา)
 *  ยอดขายแยกสาขา แยกช่องทางขาย รายได้อื่นแยกรายการ แล้วตามด้วย P&L
 *  · ไม่มีตารางแต่ละ Project · ไม่มีกล่องยังไม่ได้จด (รายการนั้นอยู่ที่กระดิ่งและ Daily Log)
 *  · กล่องที่ขายบอกยอดขายต่อกล่อง ต้นทุนต่อกล่องบอกกำไรต่อกล่อง (ก่อนหัก GP และค่าใช้จ่าย)
 *  กับต้นทุนเป็น % ของราคาขาย */
export const Owner: Story = {};

/** ยังไม่มีบันทึก: กราฟว่าง ย้อนเดือนไม่ได้ ต้นทุนต่อกล่องยังไม่มี Lot ที่จดครบ
 *  (ไม่มีบรรทัดกำไรต่อกล่อง) · ไม่มีกล่องที่ขาย: ยอดขายต่อกล่องเป็น — */
export const Empty: Story = { parameters: { db: seed } };

/** ยอดขายที่นำเข้าจากไฟล์เดิม (หลัง GP แล้ว): นับในรายได้ ไม่หัก GP ซ้ำ
 *  · ยอดขายแยกสาขา มีแถว 「ไม่ระบุสาขา」 เมื่อมียอดที่ไฟล์เดิมไม่บอกสาขา
 *  · ยอดขายแยกช่องทางขาย มีแถว 「ยอดเดิม (หลัง GP แล้ว)」 */
export const LegacySales: Story = { parameters: { db: legacyDb(today()) } };

/** จอ 390px: คอลัมน์เดียว */
export const Phone: Story = { ...phone };
