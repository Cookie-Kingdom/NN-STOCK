import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Composer } from "@/components/organisms/workspace/Composer";
import {
  WithWorkspace,
  dbFor,
  phone,
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
 *  แล้ววัสดุและน้ำพริกของทุกสาขา · นับแทนสาขาได้:「นับเนื้อ」เปิดฟอร์มนับเนื้อของสาขานั้น
 *  และกล่องวัสดุของแต่ละสาขาบันทึกยอดนับของสาขานั้น */
export const Owner: Story = {};

/** Account Manager: เห็นและนับแทนสาขาได้เหมือน Owner · แถวน้ำพริกบอก「สาขานับเอง」
 *  เพราะ Manager ไม่มีฟอร์มยอดขาย */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** จอ 390px: กล่องวัสดุของสองสาขาเรียงต่อกัน */
export const Phone: Story = { ...phone };
