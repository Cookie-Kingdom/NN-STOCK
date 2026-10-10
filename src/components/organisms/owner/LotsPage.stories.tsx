import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  WithWorkspace,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import type { AccountId } from "@/lib/accounts";
import { purchaseLots, roundsOf, seed, shipments } from "@/lib/store";
import {
  documentsDb,
  invoiceOverrideDb,
  oldLotsDb,
  overCapacityDb,
  twoRoundsDb,
} from "./LotsPage.fixtures";
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

/** เปิดหน้ามาเป็น PO รมควัน ใหม่สุด ยังไม่ได้ส่งรอบไหน · ปุ่ม「+ สร้าง PO เนื้อ」「+ สร้าง PO รมควัน」
 *  อยู่บนสุด · รายการซ้าย: ขอบเขียว = จดครบแล้ว ขอบเหลือง + ตัวเลขแดง = ยังไม่ได้จด N อย่าง */
export const Owner: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "+ สร้าง PO รมควัน" }),
    );
    await expect(args.jot).toHaveBeenLastCalledWith({ kind: "smokeOrder" });
  },
};

/** PO รมควัน ที่จดครบ: รอบเดียว สามขั้นเป็นสีเขียว กดเพื่อแก้ไข มีต้นทุนต่อ กก. และต่อกล่อง */
export const LotComplete: Story = { play: pick(/SO-\d+-0001/) };

/** PO รมควัน สองรอบ: รอบ 1 ครบสามขั้น รอบ 2 เพิ่งส่ง · กด「+ จดรับเนื้อที่ Chef House」ของรอบ 2
 *  เปิดฟอร์มของรอบนั้น */
export const TwoRounds: Story = {
  parameters: { db: twoRoundsDb },
  play: async (context) => {
    const { canvasElement, args } = context;
    await pick(/SO-\d+-0002/)!(context);
    const lot = shipments(twoRoundsDb)[1];
    const second = roundsOf(twoRoundsDb, lot.id)[1].dispatch.id;
    const card = canvasElement.querySelector(`[data-round="${second}"]`);
    await userEvent.click(
      within(card as HTMLElement).getByRole("button", {
        name: /\+ จดรับเนื้อที่ Chef House/,
      }),
    );
    await expect(args.jot).toHaveBeenLastCalledWith({
      kind: "cmReceive",
      lotId: lot.id,
      values: { dispatchId: second },
    });
  },
};

/** ส่งเกินน้ำหนักที่ซื้อบริการรม: แถบเป็นสีเหลือง「เกิน 50 กก.」(เตือน ไม่ใช่ error) */
export const OverCapacity: Story = {
  parameters: { db: overCapacityDb },
  play: pick(/SO-\d+-0001/),
};

/** PO เนื้อ ที่ยังมีเนื้อรอรับ: กล่องเหลือง「เนื้อรอรับ 15 กก.」กด「รับเนื้อรอรับแล้ว」เปิดฟอร์มรับเนื้อรอรับ */
export const PurchaseOrder: Story = {
  play: async (context) => {
    const { canvasElement, args } = context;
    await pick(/PO-\d+-0002/)!(context);
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "รับเนื้อรอรับแล้ว" }),
    );
    await expect(args.jot).toHaveBeenLastCalledWith({
      kind: "ownerWasteReceive",
      lotId: purchaseLots(sampleDb)[1].id,
      values: { receivedKg: "15" },
    });
  },
};

/** PO เนื้อ ที่ Invoice Foodiva ให้น้ำหนักและราคาต่างจาก PO: ตัวเลขขึ้น「(ตาม Invoice)」 */
export const InvoiceOverride: Story = {
  parameters: { db: invoiceOverrideDb },
  play: pick(/PO-\d+-0003/),
};

/** PO รมควัน ที่มีเอกสารครบ: PO รมควัน, Packing List, ใบขนส่งขาไปและขากลับ กดแล้วเปิดหน้าต่างพิมพ์
 *  (อนุญาต Pop-up ก่อน) หัวเอกสารมาจาก Settings */
export const Documents: Story = {
  parameters: { db: documentsDb },
  play: pick(/SO-\d+-0001/),
};

/** ระบบใหม่ ยังไม่มี PO: เหลือแค่ปุ่มสร้าง PO สองปุ่ม */
export const Empty: Story = { parameters: { db: structuredClone(seed) } };

/** The ids in the page's list. */
const listed = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll("[data-lot]")].map((el) =>
    el.getAttribute("data-lot"),
  );
const oldIds = oldLotsDb.lots.filter((lot) => lot.old).map((lot) => lot.id);

/** Lots เมื่อมี PO จากไฟล์เดิม: PO-0001 และ SO-0001 ไม่อยู่ในรายการ */
export const WithoutOld: Story = {
  parameters: { db: oldLotsDb },
  play: async ({ canvasElement }) => {
    const ids = listed(canvasElement);
    await expect(ids.length).toBeGreaterThan(0);
    await expect(ids.filter((id) => oldIds.includes(id!))).toEqual([]);
  },
};

/** จอ 390px: รายการ PO เป็นแถวเลื่อนแนวนอน รอบส่งเรียงลงมาทีละขั้น */
export const Phone: Story = {
  ...phone,
  parameters: { ...phone.parameters, db: twoRoundsDb },
  play: pick(/SO-\d+-0002/),
};

/** จอ 1920px: บันทึกของ PO อยู่ข้างตัวเลข */
export const Wide: Story = {
  ...wide,
  parameters: { ...wide.parameters, db: twoRoundsDb },
};
