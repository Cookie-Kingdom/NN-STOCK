import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { AccountId } from "@/lib/accounts";
import { liveEntries } from "@/lib/store";
import { Composer } from "./Composer";
import { WithWorkspace, dbFor, phone, sampleDb } from "./storyWorkspace";
import type { Draft } from "./useWorkspace";

const Opened = ({ account, open }: { account: AccountId; open: Draft }) => (
  <WithWorkspace account={account} open={open}>
    {(ws) => (
      <>
        <Composer ws={ws} />
        {ws.toast.message && (
          <p role="status" className="mt-3 text-body-sm text-success">
            {ws.toast.message}
          </p>
        )}
      </>
    )}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Workspace/Composer",
  component: Opened,
  tags: ["!autodocs"],
  args: { account: "owner", open: {} },
  argTypes: { account: { control: false }, open: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Opened>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 「จดอะไร」ของ Owner: ทุกชนิด กลุ่มสาขาชื่อ จดแทนสาขา · กดชนิดเพื่อเปิดฟอร์ม */
export const Picker: Story = {};

/** Account Manager: ไม่มียอดขาย */
export const PickerManager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** สาขา: จ่ายเงิน และบันทึกของสาขา */
export const PickerBranch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** ฟอร์มจ่ายเงิน: ช่องหลัก (หมวด ยอด) สีเหลืองเมื่อว่าง บันทึกได้ทั้งที่ว่าง
 *  ใส่ยอดติดลบแล้วกดบันทึกเพื่อดูข้อความที่เว็บไม่รับ */
export const Pay: Story = { args: { open: { kind: "pay" } } };

/** ส่งไปรม: มีช่อง Lot (Lot ล่าสุดถูกเลือกไว้) และ 「จดเพิ่มได้ 8 ช่อง」 */
export const Dispatch: Story = { args: { open: { kind: "dispatch" } } };

/** Owner จดยอดขายแทนสาขา: มีช่องสาขา · เปิดจากป้ายเหลืองของวัน จึงมีสาขาและวันที่มาให้ */
export const SaleForBranch: Story = {
  args: { open: { kind: "sale", branch: "มีนบุรี" } },
};

/** แก้ไข: ฟอร์มเดิมพร้อมค่าที่จดไว้ ไม่มีปุ่ม บันทึกและจดต่อ */
export const Edit: Story = {
  args: {
    open: {
      editId: liveEntries(sampleDb).find((e) => e.kind === "purchase")!.id,
    },
  },
};

/** จอ 390px: ช่องเรียงคอลัมน์เดียว */
export const Phone: Story = { ...Pay, ...phone };
