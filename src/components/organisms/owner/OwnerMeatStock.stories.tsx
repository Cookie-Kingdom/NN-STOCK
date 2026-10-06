import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  dbFor,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { accountById } from "@/lib/accounts";
import { today } from "@/lib/format";
import { mutate } from "@/lib/store";
import { countedDb, emptyDb } from "../../../../.storybook/fixtures";
import { OwnerMeatStock } from "./OwnerMeatStock";

const riceCountedDb = mutate(
  sampleDb,
  accountById("saladaeng")!,
  "materials",
  { "count.rice": "12.5" },
  "",
  today(),
);

const Stock = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => <OwnerMeatStock ws={ws} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/OwnerMeatStock",
  component: Stock,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Stock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: สองกล่องเรียงลงมา ·「เนื้อ (กก.)」: เนื้อที่ฝากไว้กับผู้ขาย คลังกลางของแต่ละ Lot
 *  และเนื้อของแต่ละสาขาพร้อมสถานะการนับ (เขียว = นับแล้ววันนี้ เหลือง = วันนี้ยังไม่ได้นับ) ·
 *  「ข้าวเหนียวและน้ำพริก」: สินค้า · สาขาศาลาแดง · สาขามีนบุรี · รวม · สถานะ ตัวเลขอย่างเดียว ·
 *  「ข้าวเหนียวดิบ (กก.)」กับ「น้ำพริก (หลอด)」: ใต้ตัวเลขของแต่ละสาขาบอกยอดนับล่าสุด
 *  (นับวันนี้ / นับ <วันที่> / นับ <วันที่> · เกิน 7 วัน / ยังไม่เคยนับ) ไม่ได้นับเกิน 7 วันเป็นสีเหลือง
 *  ไม่เหลือเป็นสีแดงเหมือนวัสดุ · สาขาที่ไม่ได้ใช้ข้าวเหนียวดิบ (มีนบุรี) เป็น「—」·
 *  ดูได้อย่างเดียว ไม่มีปุ่ม */
export const Owner: Story = {};

/** Account Manager: เห็นเหมือน Owner */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** ฐานข้อมูลเปล่า: กล่องเนื้อมีแต่แถวของสองสาขา · ข้าวเหนียวดิบและน้ำพริก「หมด」 */
export const Empty: Story = { parameters: { db: emptyDb } };

/** ศาลาแดงนับข้าวเหนียวดิบแล้ววันนี้ (12.5 กก.): ช่องของศาลาแดงบอก「นับวันนี้」สถานะ「พร้อมใช้」 */
export const RawRiceCounted: Story = { parameters: { db: riceCountedDb } };

/** ส่วนต่างตอนนับล่าสุด (นับได้ − ควรเหลือ) เป็นตัวเลขธรรมดา สีตัวหนังสือปกติ ไม่ใช่คำเตือน ·
 *  มีตั้งแต่การนับครั้งที่สอง (ครั้งแรกไม่มียอดจริงให้เทียบ) ·
 *  เนื้อ: คอลัมน์「ส่วนต่างตอนนับล่าสุด」ศาลาแดง (นับสองครั้ง)「−2 กก.」ใต้ตัวเลข
 *  「ควรเหลือ 10 · นับได้ 8 · นับ <วันที่>」มีนบุรี (นับครั้งเดียว) ข้อความสีเทา「นับครั้งแรก」·
 *  น้ำพริก: ในช่องของศาลาแดง「ส่วนต่าง −2 หลอด」「ควรเหลือ 47 · นับได้ 45」มีนบุรี「ส่วนต่าง 0 หลอด」
 *  「ควรเหลือ 20 · นับได้ 20」· ข้าวเหนียวดิบไม่มีส่วนต่าง (เว็บไม่ตัดยอดเอง) */
export const Variance: Story = { parameters: { db: countedDb(today()) } };

/** ยังไม่เคยนับเลย: คอลัมน์「ส่วนต่างตอนนับล่าสุด」ของสาขาบอก「ยังไม่เคยนับ」ไม่ใช่ 0 ·
 *  ช่องน้ำพริกไม่มีบรรทัดส่วนต่าง */
export const VarianceNeverCounted: Story = { parameters: { db: emptyDb } };

/** ส่วนต่างบนจอ 390px: หัวคอลัมน์「ส่วนต่างตอนนับล่าสุด」ตัดบรรทัดได้ หน้าไม่เลื่อนข้าง */
export const VariancePhone: Story = {
  ...phone,
  parameters: { ...phone.parameters, ...Variance.parameters },
};

/** จอ 390px: แต่ละตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: สองกล่องเรียงลงมา เต็มความกว้างของหน้า ไม่วางเคียงกัน */
export const Wide: Story = { ...wide };
