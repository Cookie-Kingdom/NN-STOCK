import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Composer } from "@/components/organisms/workspace/Composer";
import {
  WithWorkspace,
  dbFor,
  phone,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { seed } from "@/lib/store";
import { BranchSales } from "./BranchSales";

/** The page and the composer, as the shell has them: 「แก้ไข」 and 「ลบ」 of a row open it. */
const Sales = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => (
      <>
        <BranchSales ws={ws} />
        <Composer ws={ws} />
      </>
    )}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Branch/BranchSales",
  component: Sales,
  // 「แก้ไข」 and 「ลบ」 open a modal <dialog>: one per story would stack on a Docs page.
  tags: ["!autodocs"],
  args: { account: "saladaeng" },
  argTypes: { account: { control: false } },
  parameters: { db: dbFor("saladaeng") },
} satisfies Meta<typeof Sales>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sales ของศาลาแดง: บนสุดคือยอดของวันนี้ (กล่องที่ขาย ยอดขาย กล่องแจก) ·
 *  ใต้ลงมาคือยอดขายและกล่องแจกที่สาขาจดไว้ วันละการ์ด วันล่าสุดอยู่บน 7 วันแรก แล้วมี「ดูเพิ่มเติม」·
 *  กดแถวเพื่อดูทุกค่า พร้อม「แก้ไข」และ「ลบ」เหมือนหน้า Daily Log · ปุ่มจด (ยอดขาย กล่องแจก) อยู่ที่หัวหน้า */
export const WithNotes: Story = {};

/** ยังไม่เคยจดยอดขายหรือกล่องแจก: ยอดวันนี้เป็น 0 และ「ยังไม่มียอดขายหรือกล่องแจก」 */
export const Empty: Story = {
  args: { account: "minburi" },
  parameters: { db: dbFor("minburi", seed) },
};

/** จอ 390px: ยอดวันนี้และการ์ดรายวันเรียงคอลัมน์เดียว ไม่เลื่อนซ้ายขวา */
export const Phone: Story = { ...phone };
