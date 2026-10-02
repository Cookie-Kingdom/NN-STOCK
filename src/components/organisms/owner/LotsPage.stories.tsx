import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  WithWorkspace,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import type { AccountId } from "@/lib/accounts";
import { entries, seed, shipments } from "@/lib/store";
import { documentsDb } from "./LotsPage.fixtures";
import { LotsPage } from "./LotsPage";

/** The page with the composer's two openers spied on: the composer itself is the shell's. */
const Page = ({
  account,
  jot,
  edit,
}: {
  account: AccountId;
  jot: Workspace["jot"];
  edit: Workspace["edit"];
}) => (
  <WithWorkspace account={account}>
    {(ws) => <LotsPage ws={{ ...ws, jot, edit }} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Owner/LotsPage",
  component: Page,
  args: { account: "owner", jot: fn(), edit: fn() },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Presses the list button of a Lot or a PO, by its number. */
const pick =
  (number: RegExp): Story["play"] =>
  async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: number }),
    );
  };

/** เปิดหน้ามาเป็น Lot ใหม่สุด ซึ่งจดแค่ PO รมควัน: อีกสามอย่างเป็นกล่องสีเหลืองที่กดเพื่อจดได้
 *  ตัวเลขที่ยังคิดไม่ได้ขึ้น「ยังคิดไม่ได้」สีเหลือง · รายการซ้าย: ขอบเขียว = จดครบแล้ว ขอบเหลือง = ยังไม่ได้จด N อย่าง */
export const Owner: Story = {};

/** Lot ที่จดครบสี่อย่างและผูก PO เนื้อแล้ว: กล่องเขียวทั้งหมด มีต้นทุนต่อกล่อง */
export const LotComplete: Story = { play: pick(/SH-\d+-0001/) };

/** Lot ที่ส่งไปรมแล้วแต่ยังไม่ผูก PO เนื้อ: กดกล่องเหลือง「รับกลับเข้าสต๊อกกลาง」เปิดฟอร์มของ Lot นี้
 *  กด「เนื้อจาก PO ไหน」เปิดแก้ไขบรรทัดส่งไปรมที่ยังไม่ผูก */
export const LotYellow: Story = {
  play: async (context) => {
    const { canvasElement, args } = context;
    await pick(/SH-\d+-0002/)!(context);
    const canvas = within(canvasElement);
    const lot = shipments(sampleDb)[1];
    await userEvent.click(
      canvas.getByRole("button", { name: /รับกลับเข้าสต๊อกกลาง/ }),
    );
    await expect(args.jot).toHaveBeenLastCalledWith({
      kind: "central",
      lotId: lot.id,
    });
    await userEvent.click(
      canvas.getByRole("button", { name: /เนื้อจาก PO ไหน/ }),
    );
    await expect(args.edit).toHaveBeenLastCalledWith(
      entries(sampleDb, "dispatch", lot.id)[0].id,
    );
  },
};

/** PO เนื้อ: สั่งซื้อ ส่งไปรมแล้ว ฝากไว้ที่ร้านขายเนื้อ และปุ่มเอกสาร PO ซื้อเนื้อ */
export const PurchaseOrder: Story = { play: pick(/PO-\d+-0002/) };

/** Lot ที่มีเอกสารครบ: PO รมควัน, Packing List, ใบขนส่งขาไปและขากลับ กดแล้วเปิดหน้าต่างพิมพ์
 *  (อนุญาต Pop-up ก่อน) หัวเอกสารมาจาก Settings */
export const Documents: Story = {
  parameters: { db: documentsDb },
  play: pick(/SH-\d+-0001/),
};

/** Account Manager: เห็นต้นทุนของ Lot เหมือน Owner */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
  play: pick(/SH-\d+-0001/),
};

/** ระบบใหม่ ยังไม่มี Lot และ PO เนื้อ */
export const Empty: Story = { parameters: { db: structuredClone(seed) } };

/** จอ 390px: รายการ Lot เป็นแถวเลื่อนแนวนอน รายละเอียดอยู่ข้างล่าง */
export const Phone: Story = { ...phone, play: pick(/SH-\d+-0001/) };
