/** What a note says about itself in a row: its one-line summary, the muted line under it, its
 *  yellow tags and the amount at the right. Pure, per kind. */
import { fields, type Field } from "@/lib/forms";
import { baht, dateLabel, qty } from "@/lib/format";
import {
  entryBy,
  ingredients,
  isNoteKind,
  materialList,
  missingKeys,
  missingText,
  payCategories,
  purchaseLots,
  saleMoney,
  salesChannels,
  type Actor,
  type Database,
  type Entry,
  type EntryKind,
} from "@/lib/store";

const join = (...parts: (string | false | undefined)[]) =>
  parts.filter(Boolean).join(" · ");

/** A lot by the number people call it: `PO-2026-0001`, `SH-2026-0001`. */
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

/** Who jotted an entry, a branch with its name: "ผู้ดูแลสาขา ศาลาแดง". */
export const entryWho = (e: Entry) =>
  `${entryBy(e)}${e.role === "branch" ? ` ${e.branch}` : ""}`;

/** A dispatch whose meat names no live PO เนื้อ: what turns its Lot yellow (V2-LOT-03). */
export const isUnlinked = (db: Database, e: Entry) =>
  e.kind === "dispatch" &&
  !purchaseLots(db).some((lot) => lot.id === e.values.poLotId);

/** The form fields of an entry's kind, as `by` sees them; none for a retired kind. */
export const fieldsOf = (db: Database, kind: EntryKind, by: Actor): Field[] =>
  isNoteKind(kind) ? fields(kind, db, by) : [];

/** Values `mutate` adds itself: no form field carries their label. */
const addedLabels: Record<string, string> = {
  orderNumber: "เลขที่ PO รมควัน",
  transferNumber: "เลขที่ใบขนส่ง",
  subLot: "เลขที่รอบสโมค",
  postSmokeKg: "น้ำหนักผลิตรวม (กก.)",
  packCount: "จำนวนกล่องรมควัน",
};
export const addedKeys = Object.keys(addedLabels);
export const fieldLabel = (list: Field[], key: string) =>
  list.find((f) => f.key === key)?.label ?? addedLabels[key] ?? key;

/** A stored value as a person reads it: a choice by its name, a number with its unit. */
export function fieldText(db: Database, f: Field | undefined, value: string) {
  if (!f) return value;
  if (f.key === "poLotId") return lotLabel(db, value);
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

/** The yellow tags of a row: a dispatch with no PO เนื้อ, and each core field left empty. */
export function noteTags(db: Database, e: Entry, by: Actor): string[] {
  const list = fieldsOf(db, e.kind, by);
  return [
    ...(isUnlinked(db, e) ? ["ยังไม่ผูก PO เนื้อ"] : []),
    ...missingKeys(e.values).map(
      (key) => `${missingText}: ${fieldLabel(list, key)}`,
    ),
  ];
}

/** The muted line under a row: its PO or Lot number, and its branch unless a branch reads it. */
export const noteSub = (db: Database, e: Entry, by: Actor) =>
  join(
    e.lotId && lotLabel(db, e.lotId),
    e.branch && by.role !== "branch" && `สาขา${e.branch}`,
  );

/** One line of what was jotted, after the title. */
export function noteLine(db: Database, e: Entry): string {
  const v = e.values;
  const has = (key: string) => (v[key] ?? "") !== "";
  const n = (key: string) => qty(Number(v[key]));
  switch (e.kind) {
    case "purchase":
      return join(
        v.supplier,
        has("orderedKg") &&
          has("price") &&
          `${n("orderedKg")} กก. × ${n("price")} บาท`,
        has("invoiceNo") && `Invoice ${v.invoiceNo}`,
      );
    case "smokeOrder":
      return join(
        v.smoker,
        has("expectedFinishedDate") &&
          `คาดว่าเสร็จ ${dateLabel(v.expectedFinishedDate)}`,
      );
    case "dispatch":
      return join(
        !isUnlinked(db, e) && `เนื้อจาก ${lotLabel(db, v.poLotId)}`,
        v.plate,
      );
    case "central":
      return join(has("boxes") && `${n("boxes")} กล่องรมควัน`, v.reason);
    case "smokingInvoice":
      return join(has("invoiceNumber") && `Invoice ${v.invoiceNumber}`);
    case "pay": {
      const item = [...materialList(db.config), ...ingredients].find(
        (m) => m.id === v.item,
      )?.name;
      return join(
        payCategories(db.config).find((c) => c.id === v.category)?.name ??
          v.category,
        v.detail,
        v.employee,
        item && has("qty") ? `${item} ${n("qty")} เข้า${e.branch}` : item,
        v.supplier,
        has("payer") && `จ่ายโดย ${v.payer}`,
        has("fullAmount") && `ยอดเต็ม ${baht(Number(v.fullAmount))}`,
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
      return join(v.plate, v.driverName);
    case "foodivaReturnReceive":
      return join(
        has("receivedBags") && `${n("receivedBags")} กล่องรมควัน`,
        v.reason,
      );
    case "ownerWasteReceive":
      return join(v.receiver, v.note);
    case "sale":
      return join(
        has("boxes") && `${n("boxes")} กล่อง`,
        has("chiliAddons") && `น้ำพริก ${n("chiliAddons")} หลอด`,
        has("wasteKg") && `เนื้อเสีย ${n("wasteKg")} กก.`,
        has("expense") && `ค่าใช้จ่ายสาขา ${baht(Number(v.expense))}`,
      );
    case "receive":
      return join(v.reason, v.note);
    case "influencerBox":
      return join(
        v.influencer,
        has("shippingFee") && `ค่าส่ง ${baht(Number(v.shippingFee))}`,
      );
    case "materials":
      return `${Object.keys(v).filter((key) => key.startsWith("count.") && has(key)).length} รายการ`;
    case "cmReceive":
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
  if (e.kind === "smokingInvoice")
    return has("netPayable") ? { text: baht(Number(v.netPayable)) } : null;
  if (e.kind === "pay")
    return has("amount")
      ? { text: `−${baht(Number(v.amount))}`, tone: "out" }
      : null;
  if (e.kind === "sale")
    return salesChannels(db.config).some((channel) => has(channel.key))
      ? { text: `+${baht(saleMoney(db.config, e).sales)}`, tone: "in" }
      : null;
  if (e.kind === "influencerBox")
    return has("boxes") ? { text: `${qty(Number(v.boxes))} กล่อง` } : null;
  const key = kgKey[e.kind];
  return key && has(key) ? { text: `${qty(Number(v[key]))} กก.` } : null;
}
