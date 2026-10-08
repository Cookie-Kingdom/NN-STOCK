import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  WithWorkspace,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { seed } from "@/lib/store";
import { AccountingPage } from "./AccountingPage";

const Accounting = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => <AccountingPage ws={ws} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/AccountingPage",
  component: Accounting,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Accounting>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: การ์ดสองใบ 「งบที่กันไว้จาก PO」 (ยอดของ PO ที่ยังรอจ่าย) และ 「ยอดจ่ายจริงเดือนนี้」
 *  (เทียบเดือนก่อน) คิดจากตารางเสมอ · ค้นหา · แถวตัวกรองใต้หัวตาราง คอลัมน์ละช่อง (เลือกจากค่าที่มี
 *  พิมพ์คำ หรือพิมพ์ยอดขั้นต่ำ) และปุ่ม 「PO รอจ่าย (n)」
 *  ที่ตั้ง ที่มา = PO กับ สถานะ = รอจ่าย ในคลิกเดียว (กดซ้ำเพื่อล้าง) ·
 *  PO เนื้อ และ PO รมควัน ขึ้นเองเป็น 「PO เนื้อ」 กับ 「PO รมควัน」 (ยอดจ่ายจริงจากจ่ายเงินให้ผู้ขาย
 *  ตัดใบเก่าก่อน: PO รมควันแรกจ่ายแล้ว PO เนื้อแรกจ่ายไปครึ่งหนึ่งจึงรอจ่าย) ·
 *  ค่าใช้จ่ายที่จดเองครบทุกสถานะ กระดาษ A4 สองครั้งได้ SKU เดียวกัน (ใต้ชื่อรายการ) ·
 *  รายการจ่ายเงินจากหน้า Finance ขึ้นเองเป็นแถวของโปรเจกต์ สถานะจ่ายแล้ว ดูได้อย่างเดียว
 *  มีปุ่ม 「แนบเอกสาร」 เปิดฟอร์มแก้ไขของรายการจ่ายเงินนั้น (มีไฟล์แล้วเป็น 「เปิดเอกสาร」) (ค่าแรงสามคน ค่าเช่า ขนส่ง ค่ากล่องเข้าศาลาแดง ค่าส่งกล่องแจก) · ที่มาคือ
 *  ที่เลือกในฟอร์มจ่ายเงิน (ยิงโฆษณา = บัตรเครดิต · ค่าส่งกล่องของน้องฝน = พนักงานสำรองจ่าย)
 *  ไม่ได้เลือกคือเงินโอน · ตัวกรองที่มา 「Finance · จ่ายเงิน」 เลือกแถวกลุ่มนี้ · เงินที่จ่าย
 *  Foodiva / Chef House ถูก PO ตัดไปหมดจึงไม่มีแถวของตัวเอง ·
 *  กดเลข PO เพื่อไปหน้า Lots ที่ PO นั้น · แถวล่างคือยอดรวม ไม่รวมที่ยกเลิก
 *  ใต้ตารางบอก 「แสดง n จาก m รายการ」 */
export const Owner: Story = {};

/** กด 「PO รอจ่าย」 แล้วพิมพ์ยอดขั้นต่ำใต้ 「ยอดตาม PO」: ตัวกรองทั้งสามใช้ร่วมกัน ยอดรวมและ
 *  「n จาก m รายการ」 ตามแถวที่เหลือ · มีปุ่ม 「ล้างตัวกรอง」 ข้างช่องค้นหา */
export const Filtered: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /^PO รอจ่าย/ }));
    await userEvent.type(canvas.getByLabelText(/^กรอง ยอดตาม PO/), "1");
    await expect(
      canvas.getByRole("button", { name: "ล้างตัวกรอง" }),
    ).toBeVisible();
  },
};

/** Account Manager: ตารางเดียวกัน แก้ไขและลบแถวที่จดเองได้ · ไม่มีแถวค่าแรงจาก Finance */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** ยังไม่มี PO และไม่มีค่าใช้จ่าย */
export const Empty: Story = { parameters: { db: seed } };

/** จอ 390px: การ์ดเรียงสองคอลัมน์ ตัวกรองขึ้นบรรทัดใหม่ ตารางเลื่อนซ้ายขวา */
export const Phone: Story = { ...phone };
