import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import { accountById, type AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import {
  liveEntries,
  materialList,
  mutate,
  purchaseLots,
  seed,
  shipments,
  type Database,
  type NoteKind,
} from "@/lib/store";
import { Composer } from "./Composer";
import { WithWorkspace, dbFor, phone, sampleDb } from "./storyWorkspace";
import type { Draft, Workspace } from "./useWorkspace";

/** A row's 「ลบ」 on the first live note of `kind` the account jotted, pressed once on load. */
function DeleteButton({ ws, kind }: { ws: Workspace; kind: NoteKind }) {
  const { remove } = useEntryActions(ws);
  const entry = liveEntries(ws.db).find(
    (e) => e.kind === kind && e.role === ws.account.role,
  );
  useEffect(() => {
    if (entry) remove(entry);
    // Once, on mount: the story opens on the confirm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Button variant="danger" onClick={() => entry && remove(entry)}>
      ลบ
    </Button>
  );
}

const Opened = ({
  account,
  open,
  remove,
}: {
  account: AccountId;
  open?: Draft;
  /** Opens on the delete confirm of a note of this kind instead of a form. */
  remove?: NoteKind;
}) => (
  <WithWorkspace account={account} open={open}>
    {(ws) => (
      <>
        {remove && <DeleteButton ws={ws} kind={remove} />}
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
/** The dispatch form on `poDb()`: 1,000 kg to send, the two POs เนื้อ as its lines. */
const dispatchOf = (kg1: string, kg2: string): Draft => {
  const [po1, po2] = purchaseLots(poDb());
  return {
    kind: "dispatch",
    values: {
      dispatchKg: "1000",
      poLines: JSON.stringify([
        { poLotId: po1.id, kg: kg1 },
        { poLotId: po2.id, kg: kg2 },
      ]),
    },
  };
};

/** The sample with 「รายการสินค้า」 of two products (a box of meat, a tube and two bags; a
 *  tube sold apart), มีนบุรี's stock set today, and a sale of both jotted today. */
const productsDb = (() => {
  const branch = accountById("minburi")!;
  const date = today();
  const bag = materialList(sampleDb)[0].id;
  const items = (...rows: [string, string][]) =>
    rows.map(([id, qty]) => ({ id, qty }));
  let db = mutate(
    sampleDb,
    accountById("owner")!,
    "config",
    {
      products: JSON.stringify([
        {
          id: "box",
          name: "กล่องมาตรฐาน",
          items: items(["meat", "120"], ["chili", "1"], [bag, "2"]),
        },
        { id: "tube", name: "น้ำพริกหลอด", items: items(["chili", "1"]) },
      ]),
    },
    "",
    date,
  );
  for (const opening of [
    { sheet: "meat", "qty.meat": "12", "qty.chili": "60" },
    { sheet: "materials", [`qty.${bag}`]: "300" },
  ])
    db = mutate(db, branch, "opening", opening, "", date);
  return mutate(
    db,
    branch,
    "sale",
    { boxes: "24", "product.tube": "6", lineMan: "8200" },
    "",
    date,
  );
})();
const productsStory = { db: dbFor("minburi", productsDb) };

const meta = {
  title: "Organisms/Workspace/Composer",
  component: Opened,
  tags: ["!autodocs"],
  args: { account: "owner", open: { kind: "pay" } },
  argTypes: {
    account: { control: false },
    open: { control: false },
    remove: { control: false },
  },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Opened>;

export default meta;
type Story = StoryObj<typeof meta>;

/** จ่ายเงิน (lg): ช่องหลัก (หมวด ยอด) สีเหลืองเมื่อว่าง บันทึกได้ทั้งที่ว่าง ท้าย popup นับช่องที่ยังไม่ได้จด ·
 *  แถบขวา 「ตัวเลขสรุป」 คิดยอดค้างจ่ายผู้ขายก่อนและหลังจ่ายเมื่อใส่ผู้ขาย ·
 *  ใส่ยอดติดลบแล้วกดบันทึกเพื่อดูข้อความที่เว็บไม่รับ ·
 *  「ที่มา / ประเภทบิล」 ต่อจากผู้จ่าย ตัวเลือกเดียวกับฟอร์มบันทึกค่าใช้จ่าย เริ่มที่เงินโอน เว้นว่างได้ */
export const Pay: Story = {};

/** จ่ายเงินที่ใส่ผู้ขายและยอดแล้ว: แถบขวาบอกค้างจ่าย Foodiva ก่อนจ่ายและหลังจ่าย */
export const PaySupplier: Story = {
  args: {
    open: { kind: "pay", values: { supplier: "Foodiva", amount: "50000" } },
  },
};

/** แก้ไขการจ่ายเงิน: 「ก่อนจ่าย」 ไม่นับการจ่ายครั้งที่กำลังแก้ ยอดหลังจ่ายจึงเท่ากับยอดค้างจ่ายในหน้า Finance */
export const PayEdit: Story = {
  args: {
    open: {
      editId: liveEntries(sampleDb).find(
        (e) => e.kind === "pay" && e.values.supplier,
      )!.id,
    },
  },
};

/** บันทึกสั้น (md, คอลัมน์เดียว ไม่มีแถบ 「ตัวเลขสรุป」): สาขารับเนื้อเข้าสาขา ·
 *  ช่องหลักว่างเป็นสีเหลือง ท้าย popup นับว่า ยังไม่ได้จด 1 ช่อง พิมพ์แล้วเปลี่ยนเป็น จดครบแล้ว */
export const ShortNote: Story = {
  args: { account: "saladaeng", open: { kind: "receive" } },
  parameters: { db: dbFor("saladaeng") },
};

/** ช่องหลักว่างทุกช่อง: Invoice Foodiva ยังไม่ได้จดอะไร บันทึกได้ และนับไว้ท้าย popup */
export const AllCoreEmpty: Story = { args: { open: { kind: "meatInvoice" } } };

/** ส่งไปรม: น้ำหนักที่ส่งตั้งต้นเท่าที่ PO รมควันเหลือ (1,000 กก.) · กด 「เพิ่ม PO เนื้อ」
 *  เลือก PO แรก → 500 · เพิ่มอีก PO → 500 · บันทึกได้เมื่อรวมครบ (แถบขวาและท้าย popup บอกว่าขาดเท่าไร)
 *  ใส่น้ำหนักที่ส่งเกิน 1,000 เพื่อดูคำเตือนสีเหลืองในแถบขวา (ยังบันทึกได้) */
export const Dispatch: Story = {
  args: { open: { kind: "dispatch" } },
  parameters: { db: poDb() },
};

/** ส่งไปรม บรรทัด PO เนื้อรวมครบ 1,000 กก.: แถบขวาขึ้น ครบ สีเขียว บันทึกได้ */
export const DispatchBalanced: Story = {
  args: { open: dispatchOf("500", "500") },
  parameters: { db: poDb() },
};

/** ส่งไปรม บรรทัดรวมได้ 900 จาก 1,000 กก.: แถบขวาขึ้น ขาด 100 กก.
 *  ปุ่มบันทึกปิด และท้าย popup บอกเหตุผล */
export const DispatchShort: Story = {
  args: { open: dispatchOf("500", "400") },
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

/** สาขาจดยอดขายของตัวเอง (จากปุ่มบนหน้า Sales): ไม่มีช่องสาขา สาขาคือบัญชีที่เข้าใช้ */
export const SaleBranch: Story = {
  args: { account: "minburi", open: { kind: "sale" } },
  parameters: { db: dbFor("minburi") },
};

/** ยอดขายเมื่อ「รายการสินค้า」มีหลายสินค้า: เริ่มที่บรรทัดเดียว เลือกสินค้าแรกไว้ให้ ·
 *  「เพิ่มรายการ」เพิ่มบรรทัด (หายไปเมื่อทุกสินค้ามีบรรทัดแล้ว) สินค้าหนึ่งอยู่ได้บรรทัดเดียว ·
 *  บรรทัดเดียวลบไม่ได้ · พิมพ์จำนวนแล้วกล่อง「สต๊อกหลังบันทึก」ขึ้นใต้บรรทัด · มีช่อง「หลักฐานยอดขาย」 */
export const SaleProducts: Story = {
  args: { account: "minburi", open: { kind: "sale" } },
  parameters: productsStory,
};

/** ยอดขายหลายสินค้า: สองบรรทัด กล่อง「สต๊อกหลังบันทึก」บอกว่าตัดและเหลือเท่าไรต่อรายการ ณ วันที่ของฟอร์ม */
export const SaleSeveral: Story = {
  args: {
    account: "minburi",
    open: {
      kind: "sale",
      values: { boxes: "20", "product.tube": "5", lineMan: "7100" },
    },
  },
  parameters: productsStory,
};

/** แก้ไขยอดขายที่จดไว้: เปิดมาบรรทัดละสินค้าที่บันทึกมีจำนวน · 「เหลือ」ไม่นับยอดขายนี้ซ้ำ
 *  (ยังไม่แก้อะไร ตัวเลขเหลือเท่ากับในหน้า Stock) */
export const SaleEdit: Story = {
  args: {
    account: "minburi",
    open: {
      editId: liveEntries(productsDb).findLast((e) => e.kind === "sale")!.id,
    },
  },
  parameters: productsStory,
};

/** ขายเกินสต๊อก: 「เหลือ」ติดลบเป็นสีแดง บันทึกได้ตามปกติ ไม่มีคำเตือน (V2-RUL-05) */
export const SaleBelowZero: Story = {
  args: {
    account: "minburi",
    open: { kind: "sale", values: { boxes: "120", "product.tube": "40" } },
  },
  parameters: productsStory,
};

/** สาขา: จ่ายเงินได้เฉพาะหมวดของสาขา */
export const PayBranch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** กล่องแจก: จดได้หลายคนในฟอร์มเดียว แถวละคน ปุ่ม「เพิ่มอีกคน」เพิ่มแถว แถวที่ว่างทั้งแถวไม่ถูก
 *  บันทึก · บันทึกแล้วได้บันทึกแยกคนละรายการ (การแก้ไขยังเป็นฟอร์มของคนเดียว) */
export const GiftBoxes: Story = {
  args: { account: "saladaeng", open: { kind: "influencerBox" } },
  parameters: { db: dbFor("saladaeng") },
  play: async ({ canvas, userEvent }) => {
    const people = [
      ["@kinkubnong", "2", "60"],
      ["@eatwithme", "1", ""],
      ["@foodie.bkk", "1", "45"],
    ];
    for (const [index, [name, boxes, fee]] of people.entries()) {
      if (index)
        await userEvent.click(
          canvas.getByRole("button", { name: "เพิ่มอีกคน" }),
        );
      await userEvent.type(
        canvas.getAllByLabelText(/^ชื่ออินฟลูเอนเซอร์/)[index],
        name,
      );
      await userEvent.type(
        canvas.getAllByLabelText(/^กล่องมาตรฐาน/)[index],
        boxes,
      );
      if (fee)
        await userEvent.type(canvas.getAllByLabelText(/^ค่าส่ง/)[index], fee);
    }
  },
};

/** แก้ไขการส่งไปรม: ฟอร์มเดิมพร้อมค่าที่จดไว้ บรรทัดใต้ชื่อบอกว่าแก้บันทึกของวันไหน ไม่มีปุ่ม บันทึกและจดต่อ
 *  (PO เนื้อ / PO รมควัน เปิดเป็นเอกสาร PO ดู PoDocumentDialog) */
export const Edit: Story = {
  args: {
    open: {
      editId: liveEntries(sampleDb).find((e) => e.kind === "dispatch")!.id,
    },
  },
};

/** บันทึกค่าใช้จ่าย (Accounting, บันทึกยาว lg): ประเภทสินค้า รายการ ผู้ขาย Project พิมพ์ใหม่หรือเลือกจากที่เคยจด ·
 *  ช่องรายการเลือกได้จากทุกรายการที่มี SKU รวมวัสดุ · พิมพ์ 「กระดาษ A4」 เห็น SKU เดิม พิมพ์ 「ถุงซีลเนื้อ」
 *  เห็น SKU ของวัสดุ (SKU-0003) พิมพ์ชื่อใหม่เห็น 「ใหม่: SKU-…」 ทั้งใต้ช่องและในแถบขวา ·
 *  เลือก โปรเจกต์ แล้วช่อง Project ขึ้นมา (บริษัทส่วนกลาง ไม่มีช่องนี้) ·
 *  ที่มาเริ่มที่ 「เงินโอน」 ไม่มี 「เงินสดย่อย」 */
export const Expense: Story = {
  args: {
    open: {
      kind: "expense",
      values: {
        itemType: "วัสดุบรรจุภัณฑ์",
        item: "กระดาษ A4",
        qty: "5",
        amount: "1250",
        status: "pending",
      },
    },
  },
};

/** ค่าใช้จ่ายของวัสดุ: ชื่อตรงกับวัสดุใน Settings ได้ SKU ของวัสดุนั้น (SKU-0003 · เดิม) ไม่ขยับสต๊อก */
export const ExpenseOfMaterial: Story = {
  args: {
    open: {
      kind: "expense",
      values: { itemType: "วัสดุบรรจุภัณฑ์", item: "ถุงซีลเนื้อ", qty: "500" },
    },
  },
};

/** บันทึกไม่ผ่าน: ยอดที่ไม่ใช่ตัวเลข กดบันทึกแล้วข้อความที่เว็บไม่รับอยู่เหนือแถบปุ่ม เห็นเสมอไม่ต้องเลื่อนหา */
export const SaveError: Story = {
  args: {
    open: {
      kind: "expense",
      values: { ...Expense.args?.open?.values, amount: "1,250 บาท" },
    },
  },
  play: async ({ canvas, userEvent }) =>
    userEvent.click(await canvas.findByRole("button", { name: "บันทึก" })),
};

/** กด 「ลบ」: ถามก่อนลบ บอกว่ากำลังลบบันทึกไหน ผลที่ตามมา และเริ่มที่ปุ่ม ยกเลิก ·
 *  ยืนยันแล้วจึงลบ (toast มี 「เลิกทำ」 เหมือนเดิม) */
export const ConfirmDelete: Story = {
  args: { open: undefined, remove: "pay" },
};

/** ลบการส่งไปรม: บันทึกที่ไม่มียอดเงิน สรุปเหลือ 3 บรรทัด */
export const ConfirmDeleteDispatch: Story = {
  args: { open: undefined, remove: "dispatch" },
};

/** จอ 390px: ฟอร์มเต็มจอ ช่องเรียงคอลัมน์เดียว 「ตัวเลขสรุป」 เป็นกล่องท้ายฟอร์ม ปุ่มบันทึกอยู่ล่างจอเสมอ */
export const Phone: Story = { ...PaySupplier, ...phone };

/** จอ 390px: บันทึกสั้นเต็มจอ แถบปุ่มอยู่ล่างจอเสมอ */
export const PhoneShortNote: Story = {
  ...ShortNote,
  ...phone,
  parameters: { ...ShortNote.parameters, ...phone.parameters },
};

/** จอ 390px: บรรทัด PO เนื้อของการส่งไปรม · 「ตัวเลขสรุป」 เป็นกล่องท้ายฟอร์มเหนือแถบปุ่ม */
export const PhoneDispatch: Story = {
  ...DispatchShort,
  ...phone,
  parameters: { ...DispatchShort.parameters, ...phone.parameters },
};

/** จอ 390px: บรรทัดสินค้าของยอดขายและกล่อง「สต๊อกหลังบันทึก」 ไม่มีการเลื่อนแนวนอน */
export const PhoneSale: Story = {
  ...SaleBelowZero,
  ...phone,
  parameters: { ...SaleBelowZero.parameters, ...phone.parameters },
};

/** จอ 390px: ถามก่อนลบเป็น bottom sheet ชิดล่างจอ ไม่เต็มจอ ปุ่มกว้างเท่ากัน */
export const PhoneConfirmDelete: Story = { ...ConfirmDelete, ...phone };
