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
import { BranchMeatStock, BranchStock } from "./BranchStock";

/** The page and the composer, as the shell has them: 「นับเนื้อคงเหลือ」 opens its dialog over the page. */
const Stock = ({
  account,
  page = "inventory",
}: {
  account: AccountId;
  /** Stock (เนื้อ ข้าวเหนียว น้ำพริก) or Inventory (วัสดุ). */
  page?: "stock" | "inventory";
}) => (
  <WithWorkspace account={account}>
    {(ws) => (
      <>
        {page === "stock" ? (
          <BranchMeatStock ws={ws} />
        ) : (
          <BranchStock ws={ws} />
        )}
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
  argTypes: { account: { control: false }, page: { control: false } },
  parameters: { db: dbFor("minburi") },
} satisfies Meta<typeof Stock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inventory ของมีนบุรี: ตารางวัสดุหน้าตาเดียวกับของ Owner (SKU, สินค้า, คงเหลือพร้อมยอดนับล่าสุด,
 *  สถานะ) เพิ่มช่อง「นับได้」· ช่องสีแดง = ไม่เหลือ สีเหลือง = ไม่ได้นับเกิน 7 วัน ·
 *  ใส่ยอดแล้วกด「บันทึกยอดนับ」· ช่องค้นหาใช้ชื่อหรือ SKU */
export const NotCounted: Story = {};

/** Inventory ของศาลาแดง: นับวัสดุครบแล้ววันนี้ ใต้ตัวเลขเป็น「นับวันนี้」สถานะ「พร้อมใช้」 */
export const CountedToday: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng", countedDb) },
};

/** ยังไม่มีบันทึกเลย: ทุกรายการ 0 ยังไม่เคยนับ สถานะ「หมด」 */
export const NeverCounted: Story = {
  parameters: { db: dbFor("minburi", seed) },
};

/** Stock ของมีนบุรี: กล่องเนื้อเป็นสีเหลืองจนกว่าจะนับวันนี้ · มีนบุรีซื้อข้าวสุก ตารางจึงมีแต่น้ำพริก
 *  (นับในฟอร์มยอดขาย) ไม่มีปุ่ม「บันทึกยอดนับ」 */
export const StockNotCounted: Story = { args: { page: "stock" } };

/** Stock ของศาลาแดง: นับเนื้อแล้ววันนี้ กล่องเนื้อเป็นสีเขียว · ศาลาแดงนึ่งข้าวเอง
 *  มีแถว「ข้าวเหนียวดิบ (กก.)」นับเป็นทศนิยมได้ (12.5) */
export const StockCountedToday: Story = {
  args: { account: "saladaeng", page: "stock" },
  parameters: { db: dbFor("saladaeng", countedDb) },
};

/** Stock ของศาลาแดง ยังไม่เคยนับ: ข้าวเหนียวดิบและน้ำพริก 0 สถานะ「หมด」 */
export const StockNeverCounted: Story = {
  args: { account: "saladaeng", page: "stock" },
  parameters: { db: dbFor("saladaeng", seed) },
};

/** จอ 390px: ตารางเหลือ สินค้า คงเหลือ นับได้ (ไม่มี SKU และสถานะ) */
export const Phone: Story = { ...phone };

/** จอ 390px หน้า Stock */
export const StockPhone: Story = { ...phone, args: { page: "stock" } };
