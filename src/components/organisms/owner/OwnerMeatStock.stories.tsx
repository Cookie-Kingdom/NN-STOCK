import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { accountById } from "@/lib/accounts";
import { today } from "@/lib/format";
import { mutate, seed, type Database, type Values } from "@/lib/store";
import { OwnerMeatStock } from "./OwnerMeatStock";

const emptyDb: Database = structuredClone(seed);
/** `db` with the notes of today's Stock sheet (`meat`) laid on it, by the real `mutate`. */
const withNotes = (
  db: Database,
  ...notes: [AccountId, "daily" | "opening", Values][]
) =>
  notes.reduce(
    (next, [id, kind, values]) =>
      mutate(
        next,
        accountById(id)!,
        kind,
        { sheet: "meat", ...values },
        "",
        today(),
      ),
    db,
  );
const saladaengSaved: [AccountId, "daily", Values] = [
  "saladaeng",
  "daily",
  {
    "used.meat": "3.6",
    "used.rice": "2",
    "used.chili": "4",
    reporter: "น้องฝน",
  },
];

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

/** Owner: สามกล่องเรียงลงมา ·「เนื้อ (กก.)」: เนื้อที่ฝากไว้กับผู้ขายและคลังกลางของแต่ละ Lot ·
 *  「สต๊อกของสาขา」: เนื้อ ข้าวเหนียวดิบ น้ำพริก สองสาขาเคียงกัน สาขาละสองคอลัมน์ (คงเหลือ · Waste วันนี้)
 *  ตัวเลขมีหน่วยของรายการนั้น ป้ายที่หัวกล่องบอกสถานะของแต่ละสาขา ·
 *  ข้อมูลตัวอย่าง: สองสาขายังไม่บันทึกวันนี้ ป้ายเหลือง「รอบันทึกวันนี้」ช่องคงเหลือเป็นยอดล่าสุด
 *  มี「ยังไม่บันทึกวันนี้」ใต้ตัวเลข ช่อง Waste วันนี้เป็น「—」· สาขาที่ไม่ได้ใช้ข้าวเหนียวดิบ (มีนบุรี) เป็น「—」·
 *  「Waste ย้อนหลัง 7 วัน」: แต่ละรายการมียอดรวม แล้วบรรทัดละ วันที่ · สาขา · จำนวนและหน่วย · สาเหตุ
 *  (น้ำพริกของมีนบุรีไม่มีสาเหตุ ขึ้นป้ายเหลือง) หัวกล่องบอกจำนวนใบที่บันทึกแล้วจาก 14 ใบ ·
 *  ดูได้อย่างเดียว ไม่มีปุ่ม */
export const Owner: Story = {};

/** สองสาขาบันทึกวันนี้แล้ว: ป้ายเขียว「บันทึกวันนี้แล้ว · <ผู้บันทึก>」ช่องคงเหลือไม่มีบรรทัดเตือน
 *  ช่อง Waste วันนี้เป็น 0 พร้อมหน่วย */
export const BothSavedToday: Story = {
  parameters: {
    db: withNotes(sampleDb, saladaengSaved, [
      "minburi",
      "daily",
      { "used.meat": "2.4", "used.chili": "4", reporter: "พี่เอ" },
    ]),
  },
};

/** ศาลาแดงบันทึกแล้ว มีนบุรียังไม่บันทึก: มีนบุรีป้ายเหลือง「รอบันทึกวันนี้」ช่องคงเหลือเป็นยอดล่าสุด
 *  มี「ยังไม่บันทึกวันนี้」ช่อง Waste วันนี้เป็น「—」 */
export const OneNotSavedToday: Story = {
  parameters: { db: withNotes(sampleDb, saladaengSaved) },
};

/** มีนบุรียังไม่เคยตั้งสต๊อก: ป้ายสีเทา「ยังไม่ตั้งสต๊อก」ช่องคงเหลือของมีนบุรีทุกแถวเป็น
 *  「ยังไม่มีสต๊อกตั้งต้น」ไม่ใช่ 0 · ศาลาแดงตั้งสต๊อกวันนี้และบันทึกแล้ว */
export const NoOpening: Story = {
  parameters: {
    db: withNotes(
      emptyDb,
      [
        "saladaeng",
        "opening",
        { "qty.meat": "24", "qty.rice": "30", "qty.chili": "120" },
      ],
      saladaengSaved,
    ),
  },
};

/** Waste วันนี้พร้อมสาเหตุ: ศาลาแดง เนื้อ 0.5 กก.「เนื้อตกพื้น」ใต้ตัวเลข ·
 *  มีนบุรี น้ำพริก 2 หลอด ไม่ได้จดสาเหตุ ขึ้นป้ายเหลือง「ยังไม่ได้จดสาเหตุ」·
 *  สองบรรทัดนี้อยู่บนสุดของ「Waste ย้อนหลัง 7 วัน」ด้วย */
export const WasteWithReason: Story = {
  parameters: {
    db: withNotes(
      sampleDb,
      [
        "saladaeng",
        "daily",
        {
          "used.meat": "4.1",
          "waste.meat": "0.5",
          "reason.meat": "เนื้อตกพื้น",
          reporter: "น้องฝน",
        },
      ],
      [
        "minburi",
        "daily",
        { "used.chili": "6", "waste.chili": "2", reporter: "พี่เอ" },
      ],
    ),
  },
};

/** ใช้ไปมากกว่าที่มี: ช่องคงเหลือของเนื้อศาลาแดงติดลบ เป็นสีแดง */
export const NegativeRemaining: Story = {
  parameters: {
    db: withNotes(sampleDb, [
      "saladaeng",
      "daily",
      { "used.meat": "500", reporter: "น้องฝน" },
    ]),
  },
};

/** ไม่มี Waste ใน 7 วัน: สองสาขาตั้งสต๊อกวันนี้ ยังไม่บันทึก ·「Waste ย้อนหลัง 7 วัน」บอก
 *  「ยังไม่มี waste ที่บันทึกในช่วงนี้」และ「บันทึกแล้ว 0 จาก 14 ใบ」 */
export const WasteWeekEmpty: Story = {
  parameters: {
    db: withNotes(
      emptyDb,
      ["saladaeng", "opening", { "qty.meat": "24", "qty.chili": "120" }],
      ["minburi", "opening", { "qty.meat": "40", "qty.chili": "60" }],
    ),
  },
};

/** ฐานข้อมูลเปล่า: กล่องเนื้อไม่มีแถว · สองสาขา「ยังไม่ตั้งสต๊อก」· ไม่มี Waste */
export const Empty: Story = { parameters: { db: emptyDb } };

/** จอ 390px: แต่ละตารางเลื่อนในกรอบของตัวเอง หน้าไม่เลื่อนข้าง */
export const Phone: Story = { ...phone };

/** จอ 1920px: กล่องเรียงลงมา เต็มความกว้างของหน้า ไม่วางเคียงกัน */
export const Wide: Story = { ...wide };
