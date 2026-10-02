/** The fields of every note form. `mutate` validates a save with one pass over the same list,
 *  so this file imports the store's parts, never `./store` itself. */
import {
  branchCategories,
  branches,
  companyPayer,
  ingredients,
  materialList,
  payCategories,
  payrollCategory,
  salesChannels,
  stockCategories,
  type Actor,
  type Database,
  type NoteKind,
  type Values,
} from "./store/model";
import { entries, liveEntries, poInfo, purchaseLots } from "./store/derived";
export type Field = {
  key: string;
  label: string;
  unit?: string;
  hint?: string;
  type?:
    | "number"
    | "text"
    | "tel"
    | "date"
    | "time"
    | "textarea"
    | "select"
    | "file";
  /** A select's choices; on a text field, suggestions (a `<datalist>`). */
  options?: { value: string; label: string }[];
  /** Left empty it is saved, listed in `values.missing` and shown yellow. */
  core?: boolean;
  /** Rendered under "จดเพิ่มได้ N ช่อง". */
  more?: boolean;
  integer?: boolean;
  accept?: string;
  /** Hidden, and not saved, when false. */
  when?: (values: Values) => boolean;
};
const text = (key: string, label: string, extra?: Partial<Field>): Field => ({
  key,
  label,
  ...extra,
});
const number = (
  key: string,
  label: string,
  unit?: string,
  extra?: Partial<Field>,
): Field => ({ key, label, unit, type: "number", ...extra });
const count = (
  key: string,
  label: string,
  unit?: string,
  extra?: Partial<Field>,
): Field => number(key, label, unit, { integer: true, ...extra });
const time = (key: string, label: string): Field => ({
  key,
  label,
  type: "time",
});
const date = (key: string, label: string): Field => ({
  key,
  label,
  type: "date",
});
const file = (label: string): Field => ({
  key: "attachment",
  label,
  type: "file",
  accept: ".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif",
});
const core = (field: Field): Field => ({ ...field, core: true });
const more = (...fields: Field[]): Field[] =>
  fields.map((field) => ({ ...field, more: true }));
const note: Field = { key: "note", label: "หมายเหตุ", type: "textarea" };
const weightReason = text("reason", "เหตุผลเมื่อน้ำหนักต่าง");
const once = "เว็บนับเป็นจ่ายเงินให้แล้ว ไม่จด จ่ายเงิน ซ้ำ";
/** The truck and its driver, on both legs. */
const truck: Field[] = [
  text("vehicleType", "ประเภทรถ"),
  text("plate", "ทะเบียนรถ"),
  text("driverName", "ชื่อคนขับ"),
  { key: "driverPhone", label: "เบอร์คนขับ", type: "tel" },
];
/** Every half hour of the day. Every `time` field picks from this grid rather than
 *  taking a typed HH:mm — every time this app records lands on one. */
const timeSlots = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  return `${hour}:${index % 2 ? "30" : "00"}`;
});
/** The grid, plus whatever off-grid time an older entry already holds, so reopening
 *  its form never silently drops it. */
export function timeOptions(current?: string) {
  return current && !timeSlots.includes(current)
    ? [...timeSlots, current].sort()
    : timeSlots;
}
const kg = (x: number) =>
  x.toLocaleString("th-TH", { maximumFractionDigits: 2 });
/** What was typed before under `key` of `kind`, as suggestions after the `first` ones. */
const known = (db: Database, first: string[], ...keys: [NoteKind, string][]) =>
  [
    ...new Set([
      ...first,
      ...liveEntries(db).flatMap((e) =>
        keys
          .filter(([kind, key]) => e.kind === kind && e.values[key])
          .map(([, key]) => e.values[key]),
      ),
    ]),
  ].map((value) => ({ value, label: value }));
const isStock = (values: Values) => stockCategories.includes(values.category);
/** The fields of `kind`'s form, in order, for the account `by`. The entry date is not among
 *  them: every form has it (always set, today at most). */
export function fields(kind: NoteKind, db: Database, by: Actor): Field[] {
  switch (kind) {
    case "purchase":
      return [
        core(text("supplier", "ผู้ขาย")),
        core(number("orderedKg", "น้ำหนักที่สั่งซื้อ", "กก.")),
        core(number("price", "ราคา / กก.", "บาท")),
        ...more(
          text("invoiceNo", "เลข Invoice"),
          number("invoiceAmount", "ยอด Invoice", "บาท"),
          file("ไฟล์แนบ Invoice"),
          text("packSize", "ขนาดบรรจุ"),
          text("productName", "รายการสินค้า"),
          text("productCode", "รหัสสินค้า"),
          text("reference", "เลขอ้างอิงผู้ขาย"),
          note,
        ),
      ];
    case "smokeOrder":
      return [
        core(number("rawKg", "น้ำหนักที่สั่งรม", "กก.")),
        ...more(
          text("smoker", "โรงรม"),
          date("requestedSmokeDate", "วันที่ขอรม"),
          date("expectedFinishedDate", "วันที่คาดว่าเสร็จ"),
          { key: "instruction", label: "คำสั่งพิเศษ", type: "textarea" },
        ),
      ];
    case "dispatch":
      return [
        core(number("dispatchKg", "น้ำหนักที่ส่ง", "กก.")),
        {
          // Not core: left empty the Lot turns yellow instead (V2-LOT-03).
          key: "poLotId",
          label: "เนื้อจาก PO ไหน",
          type: "select",
          hint: "เว้นว่างแล้วมาผูกทีหลังได้",
          options: [
            { value: "", label: "ยังไม่ระบุ" },
            ...purchaseLots(db).map((lot) => ({
              value: lot.id,
              label: `${lot.poId} · ${entries(db, "purchase", lot.id).at(-1)?.values.supplier ?? ""} · ฝากไว้ ${kg(poInfo(db, lot.id).heldKg)} กก.`,
            })),
          ],
        },
        ...more(
          text("origin", "ต้นทาง"),
          text("destination", "ปลายทาง"),
          time("pickupTime", "เวลา"),
          ...truck,
          note,
        ),
      ];
    case "central":
      return [
        core(number("centralKg", "น้ำหนักที่รับ", "กก.")),
        core(count("boxes", "จำนวนกล่องรมควัน", "กล่อง")),
        ...more(weightReason, note),
      ];
    case "smokingInvoice":
      return [
        core(number("netPayable", "ยอดค่ารม", "บาท")),
        core(text("invoiceNumber", "เลข Invoice")),
        ...more(
          file("ไฟล์แนบ Invoice"),
          date("invoiceDate", "วันที่ Invoice"),
          { key: "invoiceDetail", label: "รายละเอียด", type: "textarea" },
        ),
      ];
    case "pay": {
      // Owner: every category. Account Manager: all but payroll. Branch: its four (V2-ACC).
      const categories = payCategories(db.config).filter((c) =>
        by.role === "branch"
          ? branchCategories.includes(c.id)
          : !(by.hidesSales && c.id === payrollCategory),
      );
      return [
        core({
          key: "category",
          label: "หมวด",
          type: "select",
          options: categories.map((c) => ({ value: c.id, label: c.name })),
        }),
        core(number("amount", "ยอด", "บาท")),
        text("detail", "รายละเอียด"),
        text("employee", "ชื่อพนักงาน", {
          when: (values) => values.category === payrollCategory,
        }),
        {
          key: "item",
          label: "รายการที่ซื้อ",
          type: "select",
          when: isStock,
          options: [
            { value: "", label: "ไม่ระบุ" },
            ...[...materialList(db.config), ...ingredients].map((m) => ({
              value: m.id,
              label: m.name,
            })),
          ],
        },
        number("qty", "จำนวน", undefined, {
          when: isStock,
          hint: "ใส่จำนวนแล้วยอดเข้าสต๊อกของสาขาทันที",
        }),
        {
          // A branch account pays into its own stock.
          key: "branch",
          label: "เข้าสาขาไหน",
          type: "select",
          when: (values) => isStock(values) && by.role !== "branch",
          options: branches.map((value) => ({ value, label: value })),
        },
        text("supplier", "ผู้ขาย", {
          options: known(
            db,
            ["Foodiva", "Chef House"],
            ["purchase", "supplier"],
            ["smokeOrder", "smoker"],
            ["pay", "supplier"],
          ),
        }),
        text("payer", "ผู้จ่าย / สำรองจ่าย", {
          options: known(
            db,
            [companyPayer],
            ["pay", "payer"],
            ["sale", "payer"],
          ),
        }),
        ...more(
          number("fullAmount", "ยอดเต็มของใบนี้", "บาท", {
            hint: "ใส่เมื่อจ่ายบางส่วนหรือมัดจำ",
          }),
          file("ใบเสร็จ"),
          note,
        ),
      ];
    }
    case "sale":
      return [
        core(count("boxes", "กล่องมาตรฐาน", "กล่อง")),
        count("chiliAddons", "น้ำพริกหลอดจำหน่ายแยก", "หลอด"),
        count("chiliCount", "นับน้ำพริกจริงปลายวัน", "หลอด"),
        text("chiliRemark", "หมายเหตุเมื่อน้ำพริกไม่ตรง"),
        number("soldKg", "เนื้อที่ใช้ไปจริง", "กก.", {
          hint: "เว้นว่างได้ เว็บคิดจากจำนวนกล่อง",
        }),
        number("wasteKg", "เนื้อที่เสียไป", "กก."),
        number("riceWasteKg", "ข้าวที่เสียไป", "กก."),
        // One money field per sales channel in Settings; only the first is core.
        ...salesChannels(db.config).map((channel, index) =>
          number(
            channel.key,
            `ยอดขาย ${channel.name}`,
            "บาท",
            index
              ? undefined
              : { core: true, hint: "ยอดจริงตามที่ LINE MAN แจ้ง" },
          ),
        ),
        number("expense", "ค่าใช้จ่ายสาขา", "บาท", { hint: once }),
        text("payer", "ผู้จ่ายเงิน / สำรองจ่าย"),
        text("reason", "เหตุผลเมื่อมีของเสีย"),
        note,
      ];
    case "receive":
      return [
        core(number("kg", "น้ำหนักรับเข้าสาขา", "กก.")),
        weightReason,
        note,
      ];
    case "meatCount":
      return [core(number("kg", "เนื้อคงเหลือที่นับได้", "กก.")), note];
    case "influencerBox":
      return [
        core(text("influencer", "ชื่ออินฟลูเอนเซอร์ / ช่อง")),
        core(count("boxes", "กล่องที่แจก", "กล่อง")),
        count("chiliAddons", "น้ำพริก", "หลอด"),
        number("shippingFee", "ค่าส่ง", "บาท", { hint: once }),
        note,
      ];
    case "materials":
      return materialList(db.config).map((m) =>
        count(`count.${m.id}`, m.name, "ชิ้น"),
      );
    case "cmReceive":
      return [
        number("receivedKg", "น้ำหนักรับรวม", "กก."),
        time("arrival", "เวลาที่รถมาถึง"),
        note,
      ];
    case "prepare":
      return [number("preSmokeKg", "น้ำหนักก่อนสโมค", "กก."), note];
    case "smoke":
      return [
        number("inputKg", "น้ำหนักเข้าเตา", "กก."),
        number("wasteKg", "Waste", "กก."),
        {
          key: "packs",
          label: "น้ำหนักกล่องรมควัน ทีละกล่อง",
          unit: "กก.",
          type: "textarea",
        },
        note,
      ];
    case "packingList":
      return [
        text("invoiceNo", "เลข Invoice"),
        text("product", "รายการสินค้า"),
        text("code", "CODE สินค้า"),
        count("boxCount", "จำนวนกล่องรับเข้า"),
        number("slicedNetKg", "น้ำหนักส่งรวม", "กก."),
        number("invWeightKg", "Inv. Weight", "กก."),
        file("ไฟล์ Packing List"),
        note,
      ];
    case "return":
      return [
        number("returnKg", "น้ำหนักส่งจาก Chef House", "กก."),
        time("returnTime", "เวลารถรับ"),
        text("origin", "ต้นทาง"),
        text("destination", "ปลายทาง"),
        ...truck,
        note,
      ];
    case "foodivaReturnReceive":
      return [
        number("receivedKg", "น้ำหนักรับจริง", "กก."),
        count("receivedBags", "จำนวนกล่องรมควันที่รับ"),
        time("receivedTime", "เวลารับ"),
        weightReason,
        note,
      ];
    case "ownerWasteReceive":
      return [
        number("receivedKg", "น้ำหนักรับจริง", "กก."),
        text("receiver", "ผู้รับเนื้อ"),
        note,
      ];
  }
}
/** What a new form of `kind` starts with; every other field starts empty. */
export function defaults(kind: NoteKind): Values {
  if (kind === "purchase") return { supplier: "Foodiva" };
  if (kind === "smokeOrder") return { smoker: "Chef House" };
  if (kind === "dispatch")
    return { origin: "กรุงเทพฯ", destination: "เชียงใหม่" };
  if (kind === "return")
    return { origin: "เชียงใหม่", destination: "กรุงเทพฯ" };
  return {};
}
