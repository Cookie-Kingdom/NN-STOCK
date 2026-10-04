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
import { dateLabel } from "./format";
import { entries, liveEntries, poInfo, purchaseLots } from "./store/derived";
import {
  defaultLedgerTypes,
  ledgerChoices,
  ledgerItems,
  ledgerPurposes,
  ledgerSources,
  ledgerStatuses,
  shopProject,
} from "./store/ledger";
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
    | "file"
    /* PO เนื้อ lines: a JSON list `[{ poLotId, kg }]` (`poLines()` reads it), the POs to pick
     * from in `options`. A PO is picked once; its kg is a number or "" (not typed yet). */
    | "poLines";
  /** A select's choices (a `poLines` field's POs); on a text field, suggestions (a `<datalist>`). */
  options?: { value: string; label: string }[];
  /** Left empty it is saved, listed in `values.missing` and shown yellow. */
  core?: boolean;
  /** Rendered in the form's last section, always open. */
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
/** A `poLines` field: the live POs เนื้อ to pick from, each with what its seller still holds. */
const poLinesField = (
  db: Database,
  key: string,
  label: string,
  extra?: Partial<Field>,
): Field => ({
  key,
  label,
  type: "poLines",
  unit: "กก.",
  options: purchaseLots(db).map((lot) => ({
    value: lot.id,
    label: `${lot.poId} · ${entries(db, "purchase", lot.id).at(-1)?.values.supplier ?? ""} · ฝากไว้ ${kg(poInfo(db, lot.id).heldKg)} กก.`,
  })),
  ...extra,
});
/** A round step's `dispatchId`: the dispatch rounds of `lotId` (every live one when no lot is
 *  given, as a row reading a saved value needs), newest first. */
const roundField = (db: Database, lotId?: string): Field => ({
  key: "dispatchId",
  label: "รอบส่งไปรมควัน",
  type: "select",
  options: [...entries(db, "dispatch", lotId)].reverse().map((e) => ({
    value: e.id,
    label: [
      e.values.transferNumber,
      e.values.dispatchKg && `${kg(Number(e.values.dispatchKg))} กก.`,
      dateLabel(e.date),
    ]
      .filter(Boolean)
      .join(" · "),
  })),
});
/** The fields of `kind`'s form, in order, for the account `by`. The entry date is not among
 *  them: every form has it (always set, today at most). `lotId`: the PO รมควัน a round step
 *  is jotted on, which narrows its rounds. */
export function fields(
  kind: NoteKind,
  db: Database,
  by: Actor,
  lotId?: string,
): Field[] {
  switch (kind) {
    case "purchase": {
      // Left empty, the PO document prints the buyer from Settings (V2-PO-03).
      const fromSettings = { hint: "เว้นว่างใช้ค่าจาก Settings" };
      return [
        core(text("supplier", "ผู้ขาย")),
        core(number("orderedKg", "น้ำหนักเนื้อ", "กก.")),
        number("wasteKg", "น้ำหนัก Waste", "กก.", {
          hint: "ไม่ส่งไปรม · เว็บเตือนจนกว่าจะจด รับ Waste",
        }),
        core(number("price", "ราคา / กก.", "บาท")),
        ...more(
          text("packSize", "ขนาดบรรจุ"),
          text("productName", "รายการสินค้า"),
          text("productCode", "รหัสสินค้า"),
          text("reference", "เลขอ้างอิงผู้ขาย"),
          text("customerName", "ชื่อบริษัท / ลูกค้า", fromSettings),
          {
            key: "customerAddress",
            label: "ที่อยู่บริษัท / ที่อยู่ออก PO",
            type: "textarea",
            ...fromSettings,
          },
          text("attention", "ชื่อผู้ติดต่อ (Attention)", fromSettings),
          { key: "phone", label: "เบอร์ติดต่อ", type: "tel", ...fromSettings },
          text("taxId", "เลขประจำตัวผู้เสียภาษี", fromSettings),
          note,
        ),
      ];
    }
    case "meatInvoice": {
      // The real goods may differ from the PO: what is typed here wins (poTerms).
      const fromPo = { hint: "เว้นว่างใช้ค่าจาก PO" };
      return [
        core(text("invoiceNumber", "เลข Invoice")),
        core(number("netPayable", "ยอด Invoice", "บาท")),
        number("orderedKg", "น้ำหนักเนื้อตาม Invoice", "กก.", fromPo),
        number("wasteKg", "น้ำหนัก Waste ตาม Invoice", "กก.", fromPo),
        number("price", "ราคา / กก. ตาม Invoice", "บาท", fromPo),
        ...more(
          date("invoiceDate", "วันที่ Invoice"),
          file("ไฟล์แนบ Invoice"),
          note,
        ),
      ];
    }
    case "ownerWasteReceive":
      return [
        core(number("receivedKg", "น้ำหนัก Waste ที่รับ", "กก.")),
        text("receiver", "ผู้รับ"),
        note,
      ];
    case "smokeOrder": {
      const rate = (key: string) => `฿${kg(Number(db.config[key]) || 0)}`;
      return [
        core(number("rawKg", "น้ำหนักที่ซื้อบริการรม", "กก.")),
        ...more(
          number("serviceRate", "ราคาค่ารม / กก.", "บาท", {
            hint: `เว้นว่าง เว็บคิดตามน้ำหนัก: ต่ำกว่า 1,000 กก. ${rate("smokeRate")} · ตั้งแต่ 1,000 กก. ${rate("smokeRate1000")} · ตั้งแต่ 1,500 กก. ${rate("smokeRate1500")}`,
          }),
          text("smoker", "โรงรม"),
          date("requestedSmokeDate", "วันที่ขอรม"),
          date("expectedFinishedDate", "วันที่คาดว่าเสร็จ"),
          { key: "instruction", label: "คำสั่งพิเศษ", type: "textarea" },
        ),
      ];
    }
    case "dispatch":
      return [
        core(number("dispatchKg", "น้ำหนักที่ส่ง", "กก.")),
        // Required: mutate refuses lines that do not add up to dispatchKg (V2-LOT-03).
        poLinesField(db, "poLines", "เนื้อจาก PO ไหน", {
          hint: "เลือกได้หลาย PO · รวมกันต้องเท่าน้ำหนักที่ส่ง",
        }),
        ...more(
          text("origin", "ต้นทาง"),
          text("destination", "ปลายทาง"),
          time("pickupTime", "เวลา"),
          ...truck,
          note,
        ),
      ];
    case "cmReceive":
      return [
        roundField(db, lotId),
        core(number("receivedKg", "น้ำหนักรับรวม", "กก.")),
        time("arrival", "เวลาที่รถมาถึง"),
        weightReason,
        note,
      ];
    case "smoked":
      return [
        roundField(db, lotId),
        core(number("smokedKg", "น้ำหนักหลังรมควัน", "กก.")),
        count("boxes", "จำนวนกล่องรมควัน", "กล่อง"),
        note,
      ];
    case "return":
      return [
        roundField(db, lotId),
        core(number("returnKg", "น้ำหนักส่งกลับ", "กก.")),
        number("shippingFee", "ค่าขนส่งไป-กลับ", "บาท", {
          hint: "ต่อรอบ รวมขาไปและขากลับ · ตั้งต้นจาก Settings",
        }),
        time("returnTime", "เวลารถรับ"),
        ...more(
          text("origin", "ต้นทาง"),
          text("destination", "ปลายทาง"),
          ...truck,
          note,
        ),
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
    case "expense": {
      const choices = (list: string[]) =>
        list.map((value) => ({ value, label: value }));
      const select = (
        key: string,
        label: string,
        labels: Record<string, string>,
        first: { value: string; label: string }[] = [],
      ): Field => ({
        key,
        label,
        type: "select",
        options: [
          ...first,
          ...Object.entries(labels).map(([value, label]) => ({ value, label })),
        ],
      });
      // A PO row is worked out from its PO: a hand-jotted row is one of the others.
      const sources = Object.fromEntries(
        Object.entries(ledgerSources).filter(([key]) => key !== "po"),
      );
      return [
        select("source", "ที่มา / ประเภทบิล", sources),
        text("reference", "เลขที่อ้างอิง (PO / ใบเสร็จ)"),
        // Typed: a new category or project is simply a new name (ledgerChoices lists it next time).
        core(
          text("itemType", "ประเภทสินค้า", {
            options: choices(ledgerChoices(db, "itemType", defaultLedgerTypes)),
          }),
        ),
        core(
          text("item", "รายการ", {
            options: ledgerItems(db).map((item) => ({
              value: item.name,
              label: item.itemNo,
            })),
          }),
        ),
        text("detail", "รายละเอียด / สเปก"),
        text("vendor", "ผู้ขาย / ร้านค้า", {
          options: choices(ledgerChoices(db, "vendor")),
        }),
        number("qty", "จำนวนซื้อ"),
        select("purpose", "ใช้เพื่องาน", ledgerPurposes),
        // ซื้อเข้าบริษัทส่วนกลาง has no project: the field is not shown, and not saved.
        text("project", "Project", {
          when: (values) => values.purpose === "project",
          options: choices(ledgerChoices(db, "project", [shopProject])),
        }),
        number("amount", "ยอดจ่ายจริง", "บาท"),
        select("status", "สถานะ", ledgerStatuses, [
          { value: "", label: "ตามยอดจ่าย (มียอด = จ่ายแล้ว)" },
        ]),
        file("เอกสารแนบ"),
        ...more(
          text("link", "ลิงก์เอกสาร", { hint: "ขึ้นต้นด้วย https://" }),
          note,
        ),
      ];
    }
    case "foodivaReturnReceive":
      return [
        number("receivedKg", "น้ำหนักรับจริง", "กก."),
        count("receivedBags", "จำนวนกล่องรมควันที่รับ"),
        time("receivedTime", "เวลารับ"),
        weightReason,
        note,
      ];
  }
}
/** The storage folder a file of a `kind` note goes to (attachment-store.ts): the kind, but a
 *  payroll receipt goes to `payroll` (Owner only) and a Foodiva invoice to `foodivaConfirm`
 *  (a folder the storage policies already take, so no SQL change). */
export const attachmentFolder = (kind: NoteKind, values: Values) =>
  kind === "pay" && values.category === payrollCategory
    ? "payroll"
    : kind === "meatInvoice"
      ? "foodivaConfirm"
      : kind;
/** What a new form of `kind` starts with; every other field starts empty. With `config`, a
 *  return's shippingFee starts at the Settings round trip (mutate fills it in when left empty). */
export function defaults(kind: NoteKind, config?: Values): Values {
  if (kind === "purchase") return { supplier: "Foodiva" };
  if (kind === "smokeOrder") return { smoker: "Chef House" };
  if (kind === "expense") return { source: "transfer", purpose: "company" };
  if (kind === "dispatch")
    return { origin: "กรุงเทพฯ", destination: "เชียงใหม่" };
  if (kind === "return")
    return {
      origin: "เชียงใหม่",
      destination: "กรุงเทพฯ",
      ...(config?.shippingFee ? { shippingFee: config.shippingFee } : {}),
    };
  return {};
}
