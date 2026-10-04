import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Composer } from "@/components/organisms/workspace/Composer";
import {
  WithWorkspace,
  dbFor,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { OwnerStock } from "./OwnerStock";

/** The page and the composer, as the shell has them: 「นับเนื้อ」 opens its dialog over the page. */
const Stock = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => (
      <>
        <OwnerStock ws={ws} />
        <Composer ws={ws} />
      </>
    )}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/OwnerStock",
  component: Stock,
  // 「นับเนื้อ」 opens a modal <dialog>: one per story would stack on a Docs page.
  tags: ["!autodocs"],
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Stock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: เนื้อที่ฝากไว้ที่ร้านขายเนื้อ สต๊อกกลางของแต่ละ Lot และเนื้อของแต่ละสาขา
 *  แล้ววัสดุและน้ำพริกของทุกสาขา ·「นับเนื้อ」เปิดฟอร์มนับเนื้อของสาขานั้น
 *  · กล่องวัสดุของแต่ละสาขาดูได้อย่างเดียว (แอดมินสาขาเป็นคนอัปเดต) ไม่มีช่องนับและปุ่มบันทึก */
export const Owner: Story = {};

/** Account Manager: เห็นเหมือน Owner · กล่องวัสดุดูได้อย่างเดียว */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** จอ 390px: กล่องวัสดุของสองสาขาเรียงต่อกัน */
export const Phone: Story = { ...phone };

/** จอ 1920px: เนื้ออยู่ซ้าย วัสดุของสาขาอยู่ขวา */
export const Wide: Story = { ...wide };
