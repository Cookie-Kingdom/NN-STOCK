import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
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
    nextjs: { navigation: { pathname: "/owner/nn-x-lm/daily-log" } },
  },
} satisfies Meta<typeof Shell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** โครงของทุกหน้า: เมนูซ้าย 256px หัวหน้า (ชื่อหน้า คำอธิบาย ปุ่มจดของหน้านั้น) แล้วตามด้วยหน้า
 *  Daily Log เป็นหน้าไว้ดู หัวหน้าไม่มีปุ่มจด
 *  ลบบันทึกแล้วข้อความแจ้งด้านล่างมี 「เลิกทำ」 */
export const Owner: Story = {};

/** กล่องจดเปิดอยู่เหนือหน้า */
export const Composing: Story = { args: { open: { kind: "pay" } } };

/** Account Manager */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** หน้า Stock ของสาขา: ปุ่มจด 5 ปุ่ม (ยอดขาย รับเนื้อเข้าสาขา นับเนื้อคงเหลือ กล่องแจก จ่ายเงิน)
 *  เรียงต่อกันและขึ้นบรรทัดใหม่เมื่อไม่พอ · หน้า Inventory ของสาขามี 2 ปุ่ม (จ่ายเงิน นับวัสดุคงเหลือ) ·
 *  หน้า Stock ของ Owner และ Account Manager ไม่มีปุ่ม หน้า Inventory ของสองบัญชีนี้มีปุ่มเดียว (InventoryButton) */
export const StockButtons: Story = {
  args: { account: "saladaeng" },
  parameters: {
    db: dbFor("saladaeng"),
    nextjs: { navigation: { pathname: "/branch/nn-x-lm/stock" } },
  },
};

/** หน้า Inventory ของ Owner (Account Manager เหมือนกัน): หัวหน้ามีปุ่ม「จัดสรรสินค้า」ปุ่มเดียว
 *  กดแล้วเปิดกล่องจด (รายการ จากคลัง ไปคลัง จำนวน การรับของ หมายเหตุ) */
export const InventoryButton: Story = {
  parameters: {
    nextjs: { navigation: { pathname: "/owner/nn-x-lm/inventory" } },
  },
  play: async ({ canvasElement }) => {
    const buttons = within(
      within(canvasElement).getByRole("group", { name: "จดบันทึก" }),
    ).getAllByRole("button");
    await expect(buttons.map((button) => button.textContent)).toEqual([
      "จัดสรรสินค้า",
    ]);
  },
};

/** หน้า Lots: หัวหน้าไม่มีปุ่ม (ปุ่มจดอยู่ในหน้า Lots เอง) */
export const LotsNoButtons: Story = {
  parameters: { nextjs: { navigation: { pathname: "/owner/nn-x-lm/lots" } } },
};

/** สาขา */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** จอ 390px หน้า Stock ของสาขา: ปุ่มขึ้นบรรทัดใหม่ แต่ละปุ่มสูง 44px */
export const PhoneStock: Story = { ...StockButtons, ...phone };

/** จอ 390px: แถบบน แท็บล่าง เนื้อหาคอลัมน์เดียว */
export const Phone: Story = { ...phone };

/** จอ 390px ขณะจด */
export const PhoneComposing: Story = { ...Composing, ...phone };
