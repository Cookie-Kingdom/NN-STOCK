import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { AccountId } from "@/lib/accounts";
import { AppSidebar } from "./AppSidebar";
import { WithWorkspace, dbFor, phone, sampleDb } from "./storyWorkspace";

const Sidebar = ({ account }: { account: AccountId }) => (
  <div className="grid grid-cols-[256px_1fr] max-md:block">
    <WithWorkspace account={account}>
      {(ws) => <AppSidebar ws={ws} />}
    </WithWorkspace>
  </div>
);

const meta = {
  title: "Organisms/Workspace/AppSidebar",
  component: Sidebar,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb, layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: แปดหน้า · Lots, Stock, Inventory, Daily Log, Finance อยู่ใต้หัวข้อ "Nerdnuea x LINE MAN" ที่ขนาดเท่าปุ่มหน้าอื่นและกดพับ/กางได้ (หน้าในกลุ่มเยื้องเข้ามาหลังเส้นนำทางใต้ไอคอนหัวข้อ เลื่อนพับลงอย่างนุ่มนวล ลูกศรหมุนตาม) · กระดิ่งเปิดรายการที่ยังไม่ได้จด (รายการเดียวกับกล่องในหน้า Daily Log) */
export const Owner: Story = {};

/** สาขา: สี่หน้า (Stock, Inventory, Sales, Daily Log) ใต้หัวข้อ "Nerdnuea x LINE MAN" */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

const openMenu: Story["play"] = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "เมนู" }));
};

/** จอ 390px, Owner (สิบหน้า): แถบบน (ชื่อบัญชี กระดิ่ง ธีม ออกจากระบบ) และแถบติดขอบล่างที่มีสี่แท็บ (Overview, Lots, Daily Log, Finance) กับปุ่ม "เมนู" · ไม่เลื่อนซ้ายขวา */
export const Phone: Story = { ...phone };

/** กด "เมนู": แผ่นขึ้นจากเหนือแถบล่าง มีทุกหน้าเรียงเหมือนแถบเมนูของจอกว้าง · หน้าใต้หัวข้อ "Nerdnuea x LINE MAN" เรียงสองคอลัมน์หลังเส้นนำทาง (Overview สองหน้าจึงแยกกันออก) · ปิดด้วย Escape กดพื้นหลัง หรือกด "เมนู" อีกครั้ง */
export const PhoneMenu: Story = { ...phone, play: openMenu };

/** จอ 390px, สาขา: สี่หน้าเป็นสี่แท็บ (Stock, Inventory, Sales, Daily Log) ไม่มีปุ่ม "เมนู" */
export const PhoneBranch: Story = {
  ...phone,
  args: { account: "saladaeng" },
  parameters: { ...phone.parameters, db: dbFor("saladaeng") },
};
