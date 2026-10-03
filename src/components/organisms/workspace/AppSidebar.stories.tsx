import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { AccountId } from "@/lib/accounts";
import { AppSidebar } from "./AppSidebar";
import { WithWorkspace, dbFor, phone, sampleDb } from "./storyWorkspace";

const Sidebar = ({ account }: { account: AccountId }) => (
  <div className="grid grid-cols-[224px_1fr] max-md:block">
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

/** Owner: หกหน้า · Daily Log, Lots, Inventory, Finance อยู่ใต้หัวข้อ "Nerdnuea x LINE MAN" ที่ขนาดเท่าปุ่มหน้าอื่นและกดพับ/กางได้ (หน้าในกลุ่มเยื้องเข้ามาหลังเส้นนำทางใต้ไอคอนหัวข้อ เลื่อนพับลงอย่างนุ่มนวล ลูกศรหมุนตาม) · กระดิ่งเปิดรายการที่ยังไม่ได้จด (รายการเดียวกับกล่องในหน้า Daily Log) */
export const Owner: Story = {};

/** Account Manager: สี่หน้า ไม่มี Overview และ Settings · ทั้งสี่หน้า (Daily Log, Lots, Inventory, Finance) อยู่ใต้หัวข้อ "Nerdnuea x LINE MAN" */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** สาขา: สองหน้า (Daily Log, Inventory) ใต้หัวข้อ "Nerdnuea x LINE MAN" */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** จอ 390px: แถบบน (ชื่อบัญชี กระดิ่ง ธีม ออกจากระบบ) และแท็บติดขอบล่าง เรียงตามเมนู ไม่มีหัวข้อกลุ่ม */
export const Phone: Story = { ...phone };
