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
import { emptyDb } from "../../../../.storybook/fixtures";
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

/** Owner: สองกล่องเรียงลงมา ·「เนื้อ (กก.)」: เนื้อที่ฝากไว้ที่ร้านขายเนื้อ สต๊อกกลางของแต่ละ Lot
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

/** จอ 390px: แต่ละตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: สองกล่องเรียงลงมา เต็มความกว้างของหน้า ไม่วางเคียงกัน */
export const Wide: Story = { ...wide };
