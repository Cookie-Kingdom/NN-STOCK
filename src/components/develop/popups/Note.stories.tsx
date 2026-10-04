import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import {
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { accountById, type AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import {
  liveEntries,
  mutate,
  purchaseLots,
  seed,
  type Database,
} from "@/lib/store";
import { DevNoteDialog, type DevNoteDialogProps } from "./DevPopups";

/** Opens on load; closing leaves a button to open it again. Nothing is saved. */
const Opened = ({
  account,
  onClose,
  ...props
}: Omit<DevNoteDialogProps, "by" | "today"> & { account: AccountId }) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>เปิด popup</Button>
      {open && (
        <DevNoteDialog
          {...props}
          by={accountById(account)!}
          today={today()}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

/** Two POs เนื้อ (500 and 600 kg) and a PO รมควัน of 1,000 kg, nothing sent yet. */
const poDb = (() => {
  const owner = accountById("owner")!;
  let db: Database = structuredClone(seed);
  for (const kg of ["500", "600"])
    db = mutate(
      db,
      owner,
      "purchase",
      { supplier: "Foodiva", orderedKg: kg, price: "300" },
      "",
      today(),
    );
  return mutate(db, owner, "smokeOrder", { rawKg: "1000" }, "", today());
})();
const [po1, po2] = purchaseLots(poDb);
const lines = (kg1: string, kg2: string) =>
  JSON.stringify([
    { poLotId: po1.id, kg: kg1 },
    { poLotId: po2.id, kg: kg2 },
  ]);

const meta = {
  title: "Develop/Popups/Note",
  component: Opened,
  // A modal <dialog> would stack on a Docs page.
  tags: ["!autodocs"],
  args: {
    account: "owner",
    db: sampleDb,
    kind: "pay",
    onClose: fn(),
    onSave: fn(),
    onSaveAgain: fn(),
  },
  argTypes: {
    account: { control: false },
    db: { control: false },
    target: { control: false },
  },
} satisfies Meta<typeof Opened>;

export default meta;
type Story = StoryObj<typeof meta>;

/** บันทึกสั้น (md, คอลัมน์เดียว ไม่มีแถบ 「เว็บคิดให้」): สาขานับเนื้อคงเหลือ ·
 *  ช่องหลักว่างเป็นสีเหลือง และท้าย popup นับว่า ยังไม่ได้จด 1 ช่อง พิมพ์แล้วเปลี่ยนเป็น จดครบแล้ว */
export const ShortNote: Story = {
  args: { account: "saladaeng", db: dbFor("saladaeng"), kind: "meatCount" },
};

/** จ่ายเงิน (lg): แถบขวาคิดยอดค้างจ่ายผู้ขายก่อนและหลังจ่ายจากผู้ขายและยอดที่พิมพ์ ·
 *  ยังไม่เลือกหมวด จึงนับ ยังไม่ได้จด 1 ช่อง */
export const Pay: Story = {
  args: { values: { supplier: "Foodiva", amount: "50000" } },
};

/** บันทึกยาว (lg): ค่าใช้จ่ายของ Accounting · แถบขวาบอก Item No. (เดิม / ใหม่) สถานะ และยอดค้างจ่าย ·
 *  แก้ชื่อรายการเป็นชื่อใหม่เพื่อดู Item No. ใหม่ */
export const Expense: Story = {
  args: {
    account: "manager",
    db: dbFor("manager"),
    kind: "expense",
    values: {
      itemType: "วัสดุบรรจุภัณฑ์",
      item: "กระดาษ A4",
      qty: "5",
      amount: "1250",
      status: "pending",
    },
  },
};

/** ส่งไปรม บรรทัด PO เนื้อรวมครบ 1,000 กก.: แถบขวาขึ้น ครบ สีเขียว บันทึกได้ */
export const DispatchBalanced: Story = {
  args: {
    db: poDb,
    kind: "dispatch",
    values: { dispatchKg: "1000", poLines: lines("500", "500") },
  },
};

/** ส่งไปรม บรรทัดรวมได้ 900 จาก 1,000 กก.: แถบขวาขึ้น ขาด 100 กก.
 *  ปุ่มบันทึกปิด และท้าย popup บอกเหตุผล */
export const DispatchShort: Story = {
  args: {
    db: poDb,
    kind: "dispatch",
    values: { dispatchKg: "1000", poLines: lines("500", "400") },
  },
};

/** แก้ไข: บรรทัดใต้ชื่อบอกว่าแก้บันทึกของวันไหน ไม่มีปุ่ม บันทึกและจดต่อ */
export const Edit: Story = {
  args: {
    kind: "dispatch",
    target: liveEntries(sampleDb).find((e) => e.kind === "dispatch"),
  },
};

/** กำลังบันทึก: ปุ่มบันทึกหมุนและกดไม่ได้ */
export const Saving: Story = { args: { ...Expense.args, saving: true } };

/** บันทึกไม่ผ่าน: ข้อความที่เว็บไม่รับอยู่เหนือแถบปุ่ม เห็นเสมอไม่ต้องเลื่อนหา */
export const SaveError: Story = {
  args: {
    ...Expense.args,
    values: { ...Expense.args?.values, amount: "1,250 บาท" },
    error: "ยอดจ่ายจริง ต้องเป็นตัวเลข",
  },
};

/** ช่องหลักว่างทุกช่อง: Invoice Foodiva ยังไม่ได้จดอะไร บันทึกได้ และนับไว้ท้าย popup */
export const AllCoreEmpty: Story = { args: { kind: "meatInvoice" } };

/** จอ 390px: บันทึกสั้นเต็มจอ แถบปุ่มอยู่ล่างจอเสมอ */
export const PhoneShortNote: Story = { ...ShortNote, ...phone };

/** จอ 390px: ส่งไปรม · 「เว็บคิดให้」 เป็นกล่องท้ายฟอร์มเหนือแถบปุ่ม */
export const PhoneDispatch: Story = { ...DispatchShort, ...phone };
