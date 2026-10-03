import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { accountById, type AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import {
  liveEntries,
  mutate,
  purchaseLots,
  seed,
  shipments,
  type Database,
} from "@/lib/store";
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

/** Two POs เนื้อ (500 and 600 kg) and a PO รมควัน of 1,000 kg, nothing sent yet: the
 *  dispatch form's lines. With `sent`, one round of 1,000 kg that Chef House received as 980. */
function poDb(sent = false): Database {
  const owner = accountById("owner")!;
  const date = today();
  let db = structuredClone(seed);
  for (const kg of ["500", "600"])
    db = mutate(
      db,
      owner,
      "purchase",
      { supplier: "Foodiva", orderedKg: kg, price: "300" },
      "",
      date,
    );
  db = mutate(db, owner, "smokeOrder", { rawKg: "1000" }, "", date);
  if (!sent) return db;
  const [po1, po2] = purchaseLots(db);
  const lot = shipments(db)[0].id;
  db = mutate(
    db,
    owner,
    "dispatch",
    {
      dispatchKg: "1000",
      poLines: JSON.stringify([
        { poLotId: po1.id, kg: "500" },
        { poLotId: po2.id, kg: "500" },
      ]),
    },
    lot,
    date,
  );
  return mutate(db, owner, "cmReceive", { receivedKg: "980" }, lot, date);
}

const meta = {
  title: "Organisms/Workspace/Composer",
  component: Opened,
  tags: ["!autodocs"],
  args: { account: "owner", open: { kind: "pay" } },
  argTypes: { account: { control: false }, open: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Opened>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ฟอร์มจ่ายเงิน: ช่องหลัก (หมวด ยอด) สีเหลืองเมื่อว่าง บันทึกได้ทั้งที่ว่าง
 *  ใส่ยอดติดลบแล้วกดบันทึกเพื่อดูข้อความที่เว็บไม่รับ */
export const Pay: Story = {};

/** ส่งไปรม: น้ำหนักที่ส่งตั้งต้นเท่าที่ PO รมควันเหลือ (1,000 กก.) · กด 「เพิ่ม PO เนื้อ」
 *  เลือก PO แรก → 500 · เพิ่มอีก PO → 500 · บันทึกได้เมื่อรวมครบ
 *  ใส่น้ำหนักที่ส่งเกิน 1,000 เพื่อดูคำเตือนสีเหลือง (ยังบันทึกได้) */
export const Dispatch: Story = {
  args: { open: { kind: "dispatch" } },
  parameters: { db: poDb() },
};

/** น้ำหนักหลังรมควัน: รอบส่งตั้งต้นที่รอบล่าสุดที่ยังไม่จด · พิมพ์น้ำหนักเพื่อดู Waste กก. และ %
 *  (ฐานคือที่ Chef House รับ 980 กก.) */
export const Smoked: Story = {
  args: { open: { kind: "smoked" } },
  parameters: { db: poDb(true) },
};

/** รับเนื้อที่ Chef House: พิมพ์น้ำหนักรับเพื่อดู ตรงกับตอนส่ง หรือ ±X กก. จากที่ส่ง */
export const CmReceive: Story = {
  args: { open: { kind: "cmReceive" } },
  parameters: { db: poDb(true) },
};

/** Owner จดยอดขายแทนสาขา: มีช่องสาขา · เปิดจากป้ายเหลืองของวัน จึงมีสาขาและวันที่มาให้ */
export const SaleForBranch: Story = {
  args: { open: { kind: "sale", branch: "มีนบุรี" } },
};

/** สาขา: จ่ายเงินได้เฉพาะหมวดของสาขา */
export const PayBranch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
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

/** จอ 390px: บรรทัด PO เนื้อของการส่งไปรม */
export const PhoneDispatch: Story = { ...Dispatch, ...phone };
