import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { seed } from "@/lib/store";
import { today } from "@/lib/format";
import { legacyDb } from "../../../../.storybook/fixtures";
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

/** Owner: รายได้จริงของร้านจากทุก Project ทุกยอดรายได้ในหน้านี้เป็นรายได้หลังหัก GP ช่องทางขาย
 *  (ยอดขาย − GP + รายได้อื่น มีบรรทัดแยกสองยอดใต้ตัวเลขใหญ่) สลับดูรายเดือนหรือรายปี
 *  · กราฟแท่งต่อวัน (ต่อเดือนในมุมมองปี) ส่วนบนสีอ่อนของแท่งคือรายได้อื่น
 *  · รายได้แต่ละ Project (มีแถว 「ส่วนกลาง」 ของรายได้อื่นที่ไม่ผูกกับ Project สองแถวรวมกัน
 *  เท่าตัวเลขใหญ่) มีกำไรและอัตรากำไรเทียบกับรายได้หลังหัก GP ไม่มีคอลัมน์กล่อง
 *  · จากรายได้ถึงกำไร เริ่มที่ยอดขายหลังหัก GP ต่อด้วยรายได้อื่น แล้วหักค่าใช้จ่ายลงมา
 *  (ไม่มีขั้น 「หัก GP ช่องทางขาย」) · ยอดขายแยกสาขา (หลังหัก GP) · รายได้อื่นแยกรายการ
 *  · ไม่มี P&L ไม่มียอดขายแยกช่องทางขาย ไม่มีแถวการ์ดตัวเลข 5 ช่อง: รายละเอียดของ Project
 *  อยู่ที่ Overview ของ Project (ProjectOverviewPage) ซึ่งเป็นอีกหน้าหนึ่ง แก้หน้านี้ไม่กระทบหน้านั้น */
export const Owner: Story = {};

/** ยังไม่มีบันทึก: กราฟว่าง ย้อนเดือนไม่ได้ ทุกยอดเป็น ฿0 หรือ — */
export const Empty: Story = { parameters: { db: seed } };

/** ยอดขายที่นำเข้าจากไฟล์เดิม (หลัง GP แล้ว): นับเต็มยอดในรายได้หลังหัก GP ไม่หัก GP ซ้ำ
 *  · ยอดขายแยกสาขา มีแถว 「ไม่ระบุสาขา」 เมื่อมียอดที่ไฟล์เดิมไม่บอกสาขา
 *  · ไม่มีรายได้อื่น: ไม่มีบรรทัดแยกใต้ตัวเลขใหญ่ ไม่มีแถวส่วนกลาง ขั้นรายได้อื่น
 *  และกล่องรายได้อื่นแยกรายการ แท่งกราฟสีเดียว */
export const LegacySales: Story = { parameters: { db: legacyDb(today()) } };

/** จอ 390px: คอลัมน์เดียว */
export const Phone: Story = { ...phone };
