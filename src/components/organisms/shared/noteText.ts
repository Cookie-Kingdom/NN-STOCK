/** What a note says about itself in a row: its one-line summary, the muted line under it, its
 *  yellow tags and the amount at the right. Pure, per kind. */
import { fields, type Field } from "@/lib/forms";
import { baht, dateLabel, qty } from "@/lib/format";
import {
  dispatchLines,
  entries,
  entryBy,
  incomeStatuses,
  incomeTypes,
  ingredients,
  isNoteKind,
  isUnlinkedDispatch,
  legacySale,
  pieces,
  pieceUnit,
  productKey,
  products,
  materialList,
  missingKeys,
  missingText,
  noBranch,
  payCategories,
  placeLabel,
  poLines,
  saleMoney,
  salesChannels,
  sheetItems,
  sheets,
  skuName,
  unpack,
  type Actor,
  type Database,
  type Entry,
  type EntryKind,
  type Values,
} from "@/lib/store";

const join = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(" · ");

/** A lot by the number people call it: `PO-2026-0001`, `SO-2026-0001`. */
export const lotLabel = (db: Database, lotId: string) =>
  db.lots.find((lot) => lot.id === lotId)?.poId ?? lotId;

/** `HH:mm` (Bangkok) of when an entry was jotted. */
export const timeOf = (at: string) =>
  new Date(at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

/** Day, month and time (Bangkok) of when an entry was jotted. */
export const jottedAt = (at: string) =>
  new Date(at).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

/** Who jotted an entry, a branch with its name: "ผู้ดูแลสาขา ศาลาแดง". A sale from the old
 *  books with no branch says so. */
export const entryWho = (e: Entry) =>
  `${entryBy(e)}${e.role === "branch" ? ` ${e.branch || noBranch}` : ""}`;

/** A dispatch whose meat is not fully linked to live POs เนื้อ: what turns its PO รมควัน
 *  yellow (V2-LOT-03). */
export const isUnlinked = isUnlinkedDispatch;

/** "PO-2026-0001 500 กก., PO-2026-0002 500 กก." of a list of PO เนื้อ lines. */
export const linesText = (
  db: Database,
  lines: { poLotId: string; kg: number }[],
) =>
  lines
    .map((line) =>
      [lotLabel(db, line.poLotId), line.kg ? `${qty(line.kg)} กก.` : ""]
        .filter(Boolean)
        .join(" "),
    )
    .join(", ");

/** The form fields of an entry's kind, as `by` sees them; none for a retired kind. `kept`: the
 *  entry's values, which keep the field of a stopped product it holds. */
export const fieldsOf = (
  db: Database,
  kind: EntryKind,
  by: Actor,
  kept?: Values,
): Field[] => (isNoteKind(kind) ? fields(kind, db, by, undefined, kept) : []);

/** Values `mutate` adds itself: no form field carries their label. */
const addedLabels: Record<string, string> = {
  orderNumber: "เลขที่ PO รมควัน",
  estimatedCost: "ค่ารมโดยประมาณ (บาท)",
  transferNumber: "เลขที่ใบขนส่ง",
  subLot: "เลขที่รอบสโมค",
  postSmokeKg: "น้ำหนักผลิตรวม (กก.)",
  packCount: "จำนวนกล่องรมควัน",
  sku: "SKU",
  // Its field left the forms with 「รายการสินค้า」; the notes saved with it still say it.
  chiliAddons: "น้ำพริกหลอดที่ขายแยก (หลอด)",
  [legacySale.key]: `${legacySale.name} (บาท)`,
};
export const addedKeys = Object.keys(addedLabels);
export const fieldLabel = (list: Field[], key: string) =>
  list.find((f) => f.key === key)?.label ?? addedLabels[key] ?? key;

/** A stored value as a person reads it: a choice by its name, a number with its unit. */
export function fieldText(db: Database, f: Field | undefined, value: string) {
  if (!f) return value;
  if (f.key === "poLotId") return lotLabel(db, value);
  if (f.type === "poLines") return linesText(db, poLines(value));
  // Not from `options`: a form offers only the categories of the account it is for.
  if (f.key === "category")
    return payCategories(db.config).find((c) => c.id === value)?.name ?? value;
  if (f.type === "select")
    return f.options?.find((o) => o.value === value)?.label ?? value;
  if (f.type === "date") return dateLabel(value);
  if (f.type === "number" && Number.isFinite(Number(value)))
    return `${qty(Number(value))}${f.unit ? ` ${f.unit}` : ""}`;
  return value;
}

/** Before → after of an edit, as `[label, text]`: only the values it changed, and where it
 *  moved the entry (its date, its lot). */
export function editDiff(
  db: Database,
  change: Entry,
  by: Actor,
): [string, string][] {
  const values = change.values;
  const from = unpack("from.", values),
    to = unpack("to.", values);
  const list = fieldsOf(db, values.targetKind as EntryKind, by, {
    ...from,
    ...to,
  });
  const shown = (key: string, value = "") =>
    value
      ? fieldText(
          db,
          list.find((f) => f.key === key),
          value,
        )
      : "–";
  return [
    ...Object.keys(to)
      // Not the bookkeeping of the entry: its `missing` list, where a file is stored.
      .filter(
        (key) =>
          key !== "missing" &&
          !key.endsWith("StorageKey") &&
          (from[key] ?? "") !== to[key],
      )
      .map((key): [string, string] => [
        fieldLabel(list, key),
        `${shown(key, from[key])} → ${shown(key, to[key])}`,
      ]),
    ...(values.toDate
      ? [
          [
            "วันที่",
            `${dateLabel(values.fromDate)} → ${dateLabel(values.toDate)}`,
          ] as [string, string],
        ]
      : []),
    ...(values.toLotId
      ? [
          [
            "PO รมควัน",
            `${values.fromLotId ? lotLabel(db, values.fromLotId) : "–"} → ${lotLabel(db, values.toLotId)}`,
          ] as [string, string],
        ]
      : []),
  ];
}

/** The yellow tags of a row: a dispatch with no PO เนื้อ, and each core field left empty. */
export function noteTags(db: Database, e: Entry, by: Actor): string[] {
  const list = fieldsOf(db, e.kind, by, e.values);
  return [
    ...(isUnlinked(db, e) ? ["ยังไม่ได้เลือก PO เนื้อ"] : []),
    ...missingKeys(e.values).map(
      (key) => `${missingText}: ${fieldLabel(list, key)}`,
    ),
  ];
}

/** The muted line under a row: its PO or Lot number, and its branch unless a branch reads it
 *  (a branch's note with none: `noBranch`). */
export const noteSub = (db: Database, e: Entry, by: Actor) =>
  join(
    e.lotId && lotLabel(db, e.lotId),
    by.role !== "branch" &&
      (e.branch ? `สาขา${e.branch}` : e.role === "branch" && noBranch),
  );

/** One line of what was jotted, after the title. */
export function noteLine(db: Database, e: Entry): string {
  const v = e.values;
  const has = (key: string) => (v[key] ?? "") !== "";
  const n = (key: string) => qty(Number(v[key]));
  /** A sale's or a gift's count of each product: "12 กล่อง", by name once there are several. */
  const list = products(db.config);
  const sold = list
    .filter((p) => has(productKey(p.id)))
    .map((p) =>
      list.length > 1
        ? `${p.name} ${n(productKey(p.id))}`
        : `${n(productKey(p.id))} กล่อง`,
    );
  // A round step: its dispatch round, by its transfer number.
  const round =
    has("dispatchId") &&
    `รอบ ${entries(db, "dispatch").find((d) => d.id === v.dispatchId)?.values.transferNumber ?? "ที่ลบไปแล้ว"}`;
  switch (e.kind) {
    case "purchase":
      return join(
        v.supplier,
        has("orderedKg") &&
          has("price") &&
          `${n("orderedKg")} กก. × ${n("price")} บาท`,
        has("wasteKg") && `เนื้อรอรับ ${n("wasteKg")} กก.`,
        // Saved before Invoice Foodiva was its own note.
        has("invoiceNo") && `Invoice ${v.invoiceNo}`,
      );
    case "meatInvoice":
      return join(
        has("invoiceNumber") && `Invoice ${v.invoiceNumber}`,
        has("orderedKg") && `เนื้อ ${n("orderedKg")} กก.`,
        has("wasteKg") && `เนื้อรอรับ ${n("wasteKg")} กก.`,
        has("price") && `${n("price")} บาท / กก.`,
      );
    case "smokeOrder":
      return join(
        v.smoker,
        has("serviceRate") && `${n("serviceRate")} บาท / กก.`,
        has("estimatedCost") && `ประมาณ ${baht(Number(v.estimatedCost))}`,
        has("expectedFinishedDate") &&
          `คาดว่าเสร็จ ${dateLabel(v.expectedFinishedDate)}`,
      );
    case "dispatch":
      return join(
        dispatchLines(v).length > 0 &&
          `เนื้อจาก ${linesText(db, dispatchLines(v))}`,
        v.plate,
      );
    case "central":
    case "smoked":
      return join(round, has("boxes") && `${n("boxes")} กล่องรมควัน`, v.reason);
    case "smokingInvoice":
      return join(has("invoiceNumber") && `Invoice ${v.invoiceNumber}`);
    case "pay": {
      const item = [...materialList(db), ...ingredients].find(
        (m) => m.id === v.item,
      )?.name;
      return join(
        payCategories(db.config).find((c) => c.id === v.category)?.name ??
          v.category,
        v.detail,
        v.employee,
        item && has("qty") ? `${item} ${n("qty")} เข้าสาขา${e.branch}` : item,
        v.supplier,
        has("payer") && `จ่ายโดย ${v.payer}`,
        has("fullAmount") && `ยอดเต็ม ${baht(Number(v.fullAmount))}`,
      );
    }
    case "reimburse":
      return join(has("payer") && `คืนให้ ${v.payer}`);
    case "income":
      return join(
        incomeTypes[v.incomeType === "sales" ? "sales" : "other"],
        salesChannels(db.config).find((c) => c.key === v.channel)?.name,
        v.item,
        has("customer") && `รับจาก ${v.customer}`,
        // รับแล้ว goes without saying: the amount at the right is in hand.
        v.status !== "paid" &&
          incomeStatuses[v.status as keyof typeof incomeStatuses],
      );
    case "expense":
      return join(
        v.itemType,
        // The name the item goes by now: a rename shows on old rows.
        v.item && (v.sku ? `${skuName(db, v.sku, v.item)} (${v.sku})` : v.item),
        v.vendor,
        v.reference,
      );
    case "transfer":
      return join(
        skuName(db, v.sku, v.itemName),
        has("qty") && n("qty"),
        has("from") &&
          has("to") &&
          `${placeLabel(v.from)} → ${placeLabel(v.to)}`,
        v.receive === "confirm" && "รอสาขายืนยันรับ",
      );
    case "transferReceive": {
      const sent = entries(db, "transfer").find((t) => t.id === v.transferId);
      return join(
        sent && skuName(db, sent.values.sku, sent.values.itemName),
        sent?.values.qty && qty(Number(sent.values.qty)),
      );
    }
    case "smoke":
      return join(has("wasteKg") && `Waste ${n("wasteKg")} กก.`, v.note);
    case "packingList":
      return join(
        has("invoiceNo") && `Invoice ${v.invoiceNo}`,
        v.product,
        has("boxCount") && `${n("boxCount")} กล่อง`,
      );
    case "return":
      return join(
        round,
        has("shippingFee") && `ค่าขนส่ง ${baht(Number(v.shippingFee))}`,
        v.plate,
        v.driverName,
      );
    case "foodivaReturnReceive":
      return join(
        has("receivedBags") && `${n("receivedBags")} กล่องรมควัน`,
        v.reason,
      );
    case "ownerWasteReceive":
      return join(v.receiver, v.note);
    case "sale":
      return join(
        ...sold,
        has(legacySale.key) &&
          `${legacySale.name} ${baht(Number(v[legacySale.key]))}`,
        has("chiliAddons") && `น้ำพริก ${n("chiliAddons")} หลอด`,
        has("wasteKg") && `เนื้อเสีย ${n("wasteKg")} กก.`,
        has("expense") && `ค่าใช้จ่ายสาขา ${baht(Number(v.expense))}`,
      );
    case "receive":
      return join(v.reason, v.note);
    case "influencerBox":
      return join(
        v.influencer,
        // The box alone is the figure at the right of the row (noteAmount).
        ...(list.length > 1 ? sold : []),
        has("chiliAddons") && `น้ำพริก ${n("chiliAddons")} หลอด`,
        has("shippingFee") && `ค่าส่ง ${baht(Number(v.shippingFee))}`,
      );
    /* A day's sheet: each row with a figure, in its unit. A sheet never named reads as both
     * (an item id is of one sheet only). */
    case "daily":
    case "opening": {
      const rows = sheets
        .filter((sheet) => !v.sheet || v.sheet === sheet)
        .flatMap((sheet) => sheetItems(db, sheet))
        .map((item) => {
          const figure = (key: string, label: string) =>
            has(`${key}.${item.id}`) &&
            `${label} ${n(`${key}.${item.id}`)} ${item.unit}`;
          const reason = v[`reason.${item.id}`];
          const said = [
            figure("qty", "ตั้งต้น"),
            figure("received", "รับเพิ่ม"),
            figure("used", "ใช้ไป"),
            Number(v[`waste.${item.id}`]) > 0 &&
              `${figure("waste", "Waste")}${reason ? ` (${reason})` : ""}`,
          ].filter(Boolean);
          return said.length > 0 && `${item.name} ${said.join(" / ")}`;
        });
      return join(
        v.sheet === "meat" ? "Stock" : v.sheet === "materials" && "Inventory",
        ...rows,
        has("reporter") && `ผู้บันทึก ${v.reporter}`,
        v.note,
      );
    }
    case "stockItem":
      return join(v.name, has("unit") && `หน่วย ${v.unit}`);
    // Retired with the daily sheet (old entries still read).
    case "materials":
      return `${Object.keys(v).filter((key) => key.startsWith("count.") && has(key)).length} รายการ`;
    case "cmReceive":
      return join(round, v.reason, v.note);
    case "prepare":
    case "meatCount":
      return v.note ?? "";
    default:
      return "";
  }
}

/** The weight a kind's row shows at the right, by the value that holds it. */
const kgKey: Partial<Record<EntryKind, string>> = {
  smokeOrder: "rawKg",
  dispatch: "dispatchKg",
  central: "centralKg",
  smoked: "smokedKg",
  cmReceive: "receivedKg",
  prepare: "preSmokeKg",
  smoke: "inputKg",
  packingList: "slicedNetKg",
  return: "returnKg",
  foodivaReturnReceive: "receivedKg",
  ownerWasteReceive: "receivedKg",
  receive: "kg",
  meatCount: "kg",
};

/** The figure at the right of a row: a weight, boxes, or baht (`in` green with a plus, `out`
 *  red with a minus). Null when the value that makes it was not jotted. */
export function noteAmount(
  db: Database,
  e: Entry,
): { text: string; tone?: "in" | "out" } | null {
  const v = e.values;
  const has = (key: string) => (v[key] ?? "") !== "";
  if (e.kind === "purchase")
    return has("orderedKg") && has("price")
      ? { text: baht(Number(v.orderedKg) * Number(v.price)) }
      : null;
  if (e.kind === "smokingInvoice" || e.kind === "meatInvoice")
    return has("netPayable") ? { text: baht(Number(v.netPayable)) } : null;
  if (e.kind === "pay" || e.kind === "reimburse" || e.kind === "expense")
    return has("amount")
      ? { text: `−${baht(Number(v.amount))}`, tone: "out" }
      : null;
  if (e.kind === "income")
    return has("amount")
      ? { text: `+${baht(Number(v.amount))}`, tone: "in" }
      : null;
  if (e.kind === "sale")
    return has(legacySale.key) ||
      salesChannels(db.config).some((channel) => has(channel.key))
      ? { text: `+${baht(saleMoney(db.config, e).sales)}`, tone: "in" }
      : null;
  if (e.kind === "influencerBox") {
    const list = products(db.config);
    return list.some((p) => has(productKey(p.id)))
      ? { text: `${qty(pieces(list, v))} ${pieceUnit(list)}` }
      : null;
  }
  const key = kgKey[e.kind];
  return key && has(key) ? { text: `${qty(Number(v[key]))} กก.` } : null;
}
