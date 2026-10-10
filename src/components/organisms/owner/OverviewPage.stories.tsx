import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { seed } from "@/lib/store";
import { today } from "@/lib/format";
import { legacyDb } from "../../../../.storybook/fixtures";
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

/** Owner: รายได้รวมของร้าน (ยอดขาย + รายได้อื่น มีบรรทัดแยกสองยอดใต้ตัวเลขใหญ่)
 *  สลับดูรายเดือนหรือรายปี · กราฟแท่งต่อวัน (ต่อเดือนในมุมมองปี) ส่วนบนสีอ่อนของแท่งคือรายได้อื่น
 *  แต่ละ Project (มีแถว 「ส่วนกลาง」 ของรายได้อื่นที่ไม่ผูกกับ Project
 *  สองแถวรวมกันเท่าตัวเลขใหญ่) จากรายได้ถึงกำไร (ยอดขาย ต่อด้วยรายได้อื่น แล้วหักลงมา)
 *  ยอดขายแยกสาขา แยกช่องทางขาย รายได้อื่นแยกรายการ แล้วตามด้วย P&L
 *  · ไม่มีกล่องยังไม่ได้จด (รายการนั้นอยู่ที่กระดิ่งและ Daily Log)
 *  · ไม่มีแถวการ์ดตัวเลข 5 ช่องใต้กราฟแล้ว (2026-10-10) */
export const Owner: Story = {};

/** ยังไม่มีบันทึก: กราฟว่าง ย้อนเดือนไม่ได้ ทุกยอดเป็น ฿0 หรือ — */
export const Empty: Story = { parameters: { db: seed } };

/** ยอดขายที่นำเข้าจากไฟล์เดิม (หลัง GP แล้ว): นับในรายได้ ไม่หัก GP ซ้ำ
 *  · ยอดขายแยกสาขา มีแถว 「ไม่ระบุสาขา」 เมื่อมียอดที่ไฟล์เดิมไม่บอกสาขา
 *  · ยอดขายแยกช่องทางขาย มีแถว 「ยอดเดิม (หลัง GP แล้ว)」
 *  · ไม่มีรายได้อื่น: ไม่มีบรรทัดแยกใต้ตัวเลขใหญ่ ไม่มีแถวส่วนกลาง ขั้นรายได้อื่น
 *  และกล่องรายได้อื่นแยกรายการ แท่งกราฟสีเดียว */
export const LegacySales: Story = { parameters: { db: legacyDb(today()) } };

/** จอ 390px: คอลัมน์เดียว */
export const Phone: Story = { ...phone };

/** Overview ของ Project (ใต้หัวข้อ Project ในเมนู): หน้าเดียวกัน มีชื่อ Project ที่รายได้รวม
 *  ไม่มีตารางแต่ละ Project · รายได้อื่นนับเฉพาะของ Project (ไม่มีดอกเบี้ยรับของส่วนกลาง) */
export const Project: Story = {
  render: () => (
    <WithWorkspace>{(ws) => <ProjectOverviewPage ws={ws} />}</WithWorkspace>
  ),
};
