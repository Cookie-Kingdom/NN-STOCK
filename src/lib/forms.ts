/** The fields of every note form. `mutate` validates a save with one pass over the same list,
 *  so this file imports the store's parts, never `./store` itself. */
import {
  branchCategories,
  branches,
  companyPayer,
  incomeTypes,
  ingredients,
  payCategories,
  payrollCategory,
  placeLabel,
  places,
  salesChannels,
  sheets,
  stockCategories,
  type Actor,
  type Database,
  type NoteKind,
  type Values,
} from "./store/model";
import { dateLabel } from "./format";
import {
  advances,
  entries,
  liveEntries,
  materialList,
  poInfo,
  purchaseLots,
  sheetItems,
} from "./store/derived";
import {
  defaultLedgerTypes,
  ledgerChoices,
  skuCatalogue,
  ledgerPurposes,
  jotSources,
  ledgerStatuses,
  incomeStatuses,
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
  /** A text field that takes only one of its `options` (searched, not added to). */
  strict?: boolean;
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
const weightReason = text("reason", "สาเหตุที่น้ำหนักไม่ตรง");
/** How a note jotted by hand was paid: the same field on the `expense` and the `pay` forms. */
const sourceField: Field = {
  key: "source",
  label: "ที่มา / ประเภทบิล",
  type: "select",
  options: Object.entries(jotSources).map(([value, label]) => ({
    value,
    label,
  })),
};
/** A select over a table of labels, and a text field's suggestions: the ledger's two forms. */
const select = (
  key: string,
  label: string,
  labels: Record<string, string>,
  extra?: Partial<Field>,
): Field => ({
  key,
  label,
  type: "select",
  options: Object.entries(labels).map(([value, label]) => ({ value, label })),
  ...extra,
});
const choices = (list: string[]) =>
  list.map((value) => ({ value, label: value }));
const linkField = text("link", "ลิงก์เอกสาร", {
  hint: "ลิงก์ที่ขึ้นต้นด้วย https://",
});
/** The items an `income` note suggests before any was typed. */
const incomeItems = [
  "ค่าสปอนเซอร์",
  "ขายเศษเนื้อ / ของเหลือ",
  "เงินคืนจากผู้ขาย",
  "ดอกเบี้ยรับ",
  "อื่นๆ",
];
const once = "นับเป็นรายการจ่ายเงินแล้ว ไม่ต้องจดจ่ายเงินซ้ำ";
/** The truck and its driver, on both legs. */
const truck: Field[] = [
  text("vehicleType", "ประเภทรถ"),
  text("plate", "ทะเบียนรถ"),
  text("driverName", "ชื่อคนขับ"),
  { key: "driverPhone", label: "เบอร์คนขับ", type: "tel" },
];
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
/** A place to keep stock in: the central warehouse or a branch. */
const placeField = (
  key: string,
  label: string,
  extra?: Partial<Field>,
): Field => ({
  key,
  label,
  type: "select",
  options: places.map((value) => ({ value, label: placeLabel(value) })),
  ...extra,
});
/** Which sheet a `daily` or an `opening` note is of: the Stock page's or the Inventory page's. */
const sheetField: Field = {
  key: "sheet",
  label: "ใบสต๊อก",
  type: "select",
  options: [
    { value: "meat", label: "Stock" },
    { value: "materials", label: "Inventory" },
  ],
};
/** One field per `figures` entry (`<figure>.<item id>`) for every row of both sheets, each
 *  saved only on its own sheet. A branch reads its own rows (no raw rice unless it steams its
 *  own, V2-BR-08); any other reader gets every row, for its label. */
const sheetFields = (
  db: Database,
  by: Actor,
  figures: [figure: string, label: string, type?: "text"][],
): Field[] =>
  sheets.flatMap((sheet) =>
    sheetItems(db, sheet, by.role === "branch" ? by.branch : undefined).flatMap(
      (item) =>
        figures.map(([figure, label, type]): Field => {
          const field = { when: (values: Values) => values.sheet === sheet };
          const name = `${item.name} · ${label}`;
          return type
            ? text(`${figure}.${item.id}`, name, field)
            : number(`${figure}.${item.id}`, name, item.unit, field);
        }),
    ),
  );
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
      const fromSettings = { hint: "ถ้าเว้นว่าง จะใช้ค่าจาก Settings" };
      return [
        core(text("supplier", "ผู้ขาย")),
        core(number("orderedKg", "น้ำหนักเนื้อ", "กก.")),
        number("wasteKg", "น้ำหนัก Waste", "กก.", {
          hint: 'ส่วนที่ไม่ส่งไปรมควัน จะมีรายการเตือนจนกว่าจะจด "รับ Waste"',
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
      const fromPo = { hint: "ถ้าเว้นว่าง จะใช้ค่าตาม PO" };
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
        core(number("rawKg", "น้ำหนักที่สั่งรมควัน", "กก.")),
        ...more(
          number("serviceRate", "ราคาค่ารม / กก.", "บาท", {
            hint: `ถ้าเว้นว่าง ค่ารมคิดตามน้ำหนัก: ต่ำกว่า 1,000 กก. ${rate("smokeRate")} · ตั้งแต่ 1,000 กก. ${rate("smokeRate1000")} · ตั้งแต่ 1,500 กก. ${rate("smokeRate1500")}`,
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
        poLinesField(db, "poLines", "PO เนื้อที่ใช้", {
          hint: "เลือกได้หลาย PO น้ำหนักรวมต้องเท่ากับน้ำหนักที่ส่ง",
        }),
        ...more(
          text("origin", "ต้นทาง"),
          text("destination", "ปลายทาง"),
          time("pickupTime", "เวลารถรับ"),
          ...truck,
          note,
        ),
      ];
    case "cmReceive":
      return [
        roundField(db, lotId),
        core(number("receivedKg", "น้ำหนักรับจริง", "กก.")),
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
          hint: "ต่อรอบ รวมขาไปและขากลับ ค่าเริ่มต้นมาจาก Settings",
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
      // Owner: every category. Branch: its four (V2-ACC).
      const categories = payCategories(db.config).filter(
        (c) => by.role !== "branch" || branchCategories.includes(c.id),
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
            ...[...materialList(db), ...ingredients].map((m) => ({
              value: m.id,
              label: m.name,
            })),
          ],
        },
        number("qty", "จำนวน", undefined, {
          when: isStock,
          hint: "จำนวนที่ใส่จะเข้าสต๊อกของสาขาทันที",
        }),
        {
          // A branch account pays into its own stock.
          key: "branch",
          label: "สาขา",
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
        text("payer", "ผู้จ่าย / ผู้สำรองจ่าย", {
          options: known(
            db,
            [companyPayer],
            ["pay", "payer"],
            ["sale", "payer"],
          ),
        }),
        sourceField,
        ...more(
          number("fullAmount", "ยอดเต็ม", "บาท", {
            hint: "สำหรับการจ่ายบางส่วนหรือมัดจำ",
          }),
          file("ใบเสร็จ"),
          note,
        ),
      ];
    }
    case "reimburse":
      return [
        core({
          key: "payer",
          label: "ผู้รับเงินคืน",
          type: "select",
          // Whoever paid out of pocket, with what is still owed to each.
          options: advances(db).map((x) => ({
            value: x.payer,
            label: `${x.payer} · ค้างคืน ${x.left.toLocaleString("th-TH")} บาท`,
          })),
        }),
        core(number("amount", "ยอดที่คืน", "บาท")),
        ...more(file("หลักฐานการโอน"), note),
      ];
    case "sale":
      return [
        core(count("boxes", "กล่องมาตรฐาน", "กล่อง")),
        count("chiliAddons", "น้ำพริกหลอดที่ขายแยก", "หลอด"),
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
        text("payer", "ผู้จ่าย / ผู้สำรองจ่าย"),
        note,
      ];
    case "receive":
      return [
        core(number("kg", "น้ำหนักรับเข้าสาขา", "กก.")),
        weightReason,
        note,
      ];
    case "influencerBox":
      return [
        core(text("influencer", "ชื่ออินฟลูเอนเซอร์ / ช่อง")),
        core(count("boxes", "กล่องที่แจก", "กล่อง")),
        count("chiliAddons", "น้ำพริก", "หลอด"),
        number("shippingFee", "ค่าส่ง", "บาท", { hint: once }),
        note,
      ];
    /* A day's sheet (V2-CAL-10): per row what the branch took in by hand, what it used and,
     * of that, what was waste, with the reason (`mutate` lists a waste with none as missing). */
    case "daily":
      return [
        sheetField,
        ...sheetFields(db, by, [
          ["received", "รับเข้า"],
          ["used", "ใช้ไป"],
          ["waste", "Waste"],
          ["reason", "สาเหตุ Waste", "text"],
        ]),
        core(text("reporter", "ผู้บันทึก")),
        note,
      ];
    // What the rows hold at the start of the note's date; a row left empty is not set.
    case "opening":
      return [
        sheetField,
        ...sheetFields(db, by, [["qty", "สต๊อกเริ่มต้น"]]),
        note,
      ];
    // One row of the material list: `id` empty adds it, an id of the list changes that row.
    case "stockItem":
      return [
        text("id", "รหัสรายการ"),
        text("name", "ชื่อรายการ"),
        text("unit", "หน่วย"),
      ];
    case "packingList":
      return [
        text("invoiceNo", "เลข Invoice"),
        text("product", "รายการสินค้า"),
        text("code", "รหัสสินค้า"),
        count("boxCount", "จำนวนกล่องรับเข้า"),
        number("slicedNetKg", "น้ำหนักส่งรวม", "กก."),
        number("invWeightKg", "Inv. Weight", "กก."),
        file("ไฟล์ Packing List"),
        note,
      ];
    case "expense":
      return [
        // A PO row is worked out from the log: a hand-jotted row is one of the others.
        sourceField,
        text("reference", "เลขที่อ้างอิง (PO / ใบเสร็จ)"),
        // Typed: a new category or project is simply a new name (ledgerChoices lists it next time).
        core(
          text("itemType", "ประเภทสินค้า", {
            options: choices(ledgerChoices(db, "itemType", defaultLedgerTypes)),
          }),
        ),
        core(
          text("item", "รายการ", {
            // Every item with a SKU, the materials included: picking one links its SKU.
            options: skuCatalogue(db).map((item) => ({
              value: item.name,
              label: item.sku,
            })),
          }),
        ),
        text("detail", "รายละเอียด / สเปก"),
        text("vendor", "ผู้ขาย / ร้านค้า", {
          options: choices(ledgerChoices(db, "vendor")),
        }),
        number("qty", "จำนวนซื้อ"),
        select("purpose", "ค่าใช้จ่ายของ", ledgerPurposes),
        // บริษัทส่วนกลาง has no project: the field is not shown, and not saved.
        text("project", "Project", {
          when: (values) => values.purpose === "project",
          options: choices(ledgerChoices(db, "project", [shopProject])),
        }),
        // Where what was bought is kept; none typed (an old row) is the central warehouse.
        placeField("warehouse", "คลัง", {
          when: (values) => values.purpose === "project",
        }),
        number("amount", "ยอดจ่ายจริง", "บาท"),
        select("status", "สถานะ", ledgerStatuses),
        file("เอกสารแนบ"),
        ...more(linkField, note),
      ];
    /* Money in (V2-PAY-09). รับเงินค่าขาย is the cash a channel paid for sales the branches
     * already jotted: it names the channel, and is never revenue again. */
    case "income":
      return [
        select("incomeType", "ประเภทรายรับ", incomeTypes),
        select(
          "channel",
          "ช่องทางขาย",
          Object.fromEntries(
            salesChannels(db.config).map((c) => [c.key, c.name]),
          ),
          { when: (values) => values.incomeType === "sales" },
        ),
        // Core, but a sales receipt naming its channel may leave it empty (`mutate`).
        core(
          text("item", "รายการ", {
            options: choices(ledgerChoices(db, "item", incomeItems, "income")),
          }),
        ),
        text("detail", "รายละเอียด"),
        text("customer", "รับจาก", {
          options: choices(ledgerChoices(db, "customer", [], "income")),
        }),
        text("reference", "เลขที่อ้างอิง"),
        select("purpose", "รายรับของ", ledgerPurposes),
        // The projects of both ledger forms: an income is often for one that has expenses.
        text("project", "Project", {
          when: (values) => values.purpose === "project",
          options: choices([
            ...new Set([
              ...ledgerChoices(db, "project", [shopProject]),
              ...ledgerChoices(db, "project", [], "income"),
            ]),
          ]),
        }),
        core(number("amount", "ยอดรับจริง", "บาท")),
        select("status", "สถานะ", incomeStatuses),
        file("เอกสารแนบ"),
        ...more(linkField, note),
      ];
    case "transfer":
      return [
        core(
          text("item", "รายการ", {
            // Searched by name or SKU; only an item of the catalogue stands (`mutate` checks).
            strict: true,
            options: skuCatalogue(db).map((item) => ({
              value: item.name,
              label: item.sku,
            })),
          }),
        ),
        core(placeField("from", "คลังต้นทาง")),
        core(placeField("to", "คลังปลายทาง")),
        core(number("qty", "จำนวน")),
        {
          // What goes to the central warehouse is there at once.
          key: "receive",
          label: "การรับของ",
          type: "select",
          when: (values) => branches.includes(values.to),
          options: [
            { value: "now", label: "เข้าสต๊อกสาขาทันที" },
            { value: "confirm", label: "รอสาขายืนยันรับ" },
          ],
        },
        note,
      ];
    case "transferReceive":
      return [
        {
          key: "transferId",
          label: "รายการจัดสรร",
          type: "select",
          // Every transfer sent to the branch (to any, for another reader), so a saved
          // receipt still reads; `mutate` takes only one still waiting.
          options: entries(db, "transfer")
            .filter((e) => by.role !== "branch" || e.values.to === by.branch)
            .map((e) => ({
              value: e.id,
              label: [e.values.itemName, e.values.qty, dateLabel(e.date)]
                .filter(Boolean)
                .join(" · "),
            })),
        },
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
  }
}
/** The storage folder a file of a `kind` note goes to (attachment-store.ts): the kind, but a
 *  payroll receipt goes to `payroll` (Owner only), a Foodiva invoice to `foodivaConfirm` and
 *  a ledger expense's or income's document to `purchase` (folders the storage policies already take, so
 *  no SQL change: a folder they do not list is refused with a 400). */
export const attachmentFolder = (kind: NoteKind, values: Values) =>
  kind === "pay" && values.category === payrollCategory
    ? "payroll"
    : kind === "meatInvoice"
      ? "foodivaConfirm"
      : kind === "expense" || kind === "income"
        ? "purchase"
        : kind;
/** What a new form of `kind` starts with; every other field starts empty. With `config`, a
 *  return's shippingFee starts at the Settings round trip (mutate fills it in when left empty). */
export function defaults(kind: NoteKind, config?: Values): Values {
  if (kind === "purchase") return { supplier: "Foodiva" };
  if (kind === "smokeOrder") return { smoker: "Chef House" };
  if (kind === "pay") return { source: "transfer" };
  if (kind === "expense")
    return { source: "transfer", purpose: "company", warehouse: "central" };
  if (kind === "income") return { incomeType: "other", purpose: "company" };
  if (kind === "transfer") return { from: "central", receive: "now" };
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
