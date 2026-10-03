import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DailyLog } from "@/components/organisms/shared/DailyLog";
import {
  WithWorkspace,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { Draft } from "@/components/organisms/workspace/useWorkspace";
import type { AccountId } from "@/lib/accounts";
import { WorkspaceShell } from "./WorkspaceShell";

const Shell = ({ account, open }: { account: AccountId; open?: Draft }) => (
  <WithWorkspace account={account} open={open}>
    {(ws) => (
      <WorkspaceShell ws={ws}>
        <DailyLog ws={ws} />
      </WorkspaceShell>
    )}
  </WithWorkspace>
);

const meta = {
  title: "Templates/WorkspaceShell",
  component: Shell,
  tags: ["!autodocs"],
  args: { account: "owner" },
  argTypes: { account: { control: false }, open: { control: false } },
  parameters: {
    db: sampleDb,
    layout: "fullscreen",
    nextjs: { navigation: { segments: ["log"] } },
  },
} satisfies Meta<typeof Shell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** โครงของทุกหน้า: เมนูซ้าย 224px หัวหน้า (ชื่อหน้า คำอธิบาย ปุ่มจดของหน้านั้น) แล้วตามด้วยหน้า
 *  Daily Log มีปุ่ม 「ยอดขาย」 「จ่ายเงิน」 · กดเพื่อเปิดฟอร์มใต้หัวหน้า
 *  ลบบันทึกแล้วข้อความแจ้งด้านล่างมี 「เลิกทำ」 */
export const Owner: Story = {};

/** กล่องจดเปิดอยู่ใต้หัวหน้า */
export const Composing: Story = { args: { open: { kind: "pay" } } };

/** Account Manager: ไม่มียอดขาย มีแต่ 「จ่ายเงิน」 */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** หน้า Inventory: ปุ่มจดของสาขา 3 ปุ่ม (นับวัสดุเป็นงานของแอดมินสาขา) เรียงต่อกันและขึ้นบรรทัดใหม่เมื่อไม่พอ */
export const StockButtons: Story = {
  parameters: { nextjs: { navigation: { segments: ["stock"] } } },
};

/** หน้า Lots: หัวหน้าไม่มีปุ่ม (ปุ่มจดอยู่ในหน้า Lots เอง) */
export const LotsNoButtons: Story = {
  parameters: { nextjs: { navigation: { segments: ["lots"] } } },
};

/** สาขา */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** จอ 390px หน้า Inventory: ปุ่มขึ้นบรรทัดใหม่ แต่ละปุ่มสูง 44px */
export const PhoneStock: Story = { ...StockButtons, ...phone };

/** จอ 390px: แถบบน แท็บล่าง เนื้อหาคอลัมน์เดียว */
export const Phone: Story = { ...phone };

/** จอ 390px ขณะจด */
export const PhoneComposing: Story = { ...Composing, ...phone };
