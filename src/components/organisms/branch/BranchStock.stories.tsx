import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Composer } from "@/components/organisms/workspace/Composer";
import {
  WithWorkspace,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { accountById, type AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import { materialList, mutate, seed } from "@/lib/store";
import { BranchStock } from "./BranchStock";

/** The page and the composer, as the shell has them: 「นับเนื้อคงเหลือ」 opens its dialog over the page. */
const Stock = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => (
      <>
        <BranchStock ws={ws} />
        <Composer ws={ws} />
      </>
    )}
  </WithWorkspace>
);

const saladaeng = accountById("saladaeng")!;
/** The sample after ศาลาแดง counted its meat and every material today. */
const countedDb = [
  ["meatCount", { kg: "11.5" }] as const,
  [
    "materials",
    Object.fromEntries([
      ...materialList(sampleDb.config).map((m, i) => [
        `count.${m.id}`,
        String(40 + i * 15),
      ]),
      ["count.rice", "12.5"],
    ]),
  ] as const,
].reduce(
  (db, [kind, values]) => mutate(db, saladaeng, kind, values, "", today()),
  sampleDb,
);

const meta = {
  title: "Organisms/Branch/BranchStock",
  component: Stock,
  // 「นับเนื้อ」 opens a modal <dialog>: one per story would stack on a Docs page.
  tags: ["!autodocs"],
  args: { account: "minburi" },
  argTypes: { account: { control: false } },
  parameters: { db: dbFor("minburi") },
} satisfies Meta<typeof Stock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** มีนบุรี: วันนี้ยังไม่ได้นับเนื้อ กล่องเนื้อเป็นสีเหลือง · วัสดุที่ไม่ได้นับเกิน 7 วันเป็นสีเหลือง
 *  ใส่ยอดในช่อง「นับได้」แล้วกด「บันทึกยอดนับ」แถวนั้นเป็นสีเขียว · น้ำพริกนับในฟอร์มยอดขาย ·
 *  มีนบุรีซื้อข้าวสุก จึงไม่มีแถว「ข้าวเหนียวดิบ (กก.)」(ตั้งที่ Settings ว่าสาขาไหนใช้ข้าวเหนียวดิบ) */
export const NotCounted: Story = {};

/** ศาลาแดง: นับเนื้อและวัสดุครบแล้ววันนี้ กล่องเนื้อและช่องนับล่าสุดเป็นสีเขียว ·
 *  ศาลาแดงนึ่งข้าวเอง มีแถว「ข้าวเหนียวดิบ (กก.)」ต่อจากวัสดุ นับเป็นทศนิยมได้ (12.5) */
export const CountedToday: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng", countedDb) },
};

/** ยังไม่มีบันทึกเลย: ทุกรายการยังไม่เคยนับ */
export const NeverCounted: Story = {
  parameters: { db: dbFor("minburi", seed) },
};

/** ศาลาแดง ยังไม่เคยนับ: แถว「ข้าวเหนียวดิบ (กก.)」เป็นสีเหลือง「ยังไม่เคยนับ」เหมือนวัสดุ */
export const RawRiceNeverCounted: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng", seed) },
};

/** จอ 390px */
export const Phone: Story = { ...phone };
