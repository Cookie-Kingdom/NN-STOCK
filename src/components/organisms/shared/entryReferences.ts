/** LNK-07: ids one entry keeps of another (`orderId`, `allocation`, `lines`…) read as the
 *  document they name, never as a raw id. */
import {
  branchMeatKinds,
  entries,
  n,
  titles,
  type Database,
  type Entry,
  type EntryKind,
} from "@/lib/store";
import { fmt } from "@/lib/format";

/** "12 ก.ย." for a YYYY-MM-DD business date. */
const shortDate = (date = "") =>
  date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
      })
    : "";

/** A batch or purchase PO by its PO number; `""` is the branch's "ไม่ระบุ Lot" bucket. */
export function lotName(db: Database | undefined, lotId: string) {
  if (!lotId) return "ยังไม่ผูก Lot";
  const lot = db?.lots.find((l) => l.id === lotId);
  if (!lot) return lotId;
  return lot.poId && lot.poId !== lot.id ? `${lot.poId} · ${lot.id}` : lot.id;
}

/** One entry as the document it is: "ใบจัดสรร 12 ก.ย. · ศาลาแดง 17.50 กก.". */
export function entryName(db: Database | undefined, id: string) {
  const e = db?.entries.find((x) => x.id === id);
  if (!e) return undefined;
  const on = shortDate(e.date);
  switch (e.kind) {
    case "allocate":
      return `ใบจัดสรร ${shortDate(e.values.deliveryDate || e.date)} · ${e.values.branch} ${fmt(n(e.values, "kg"))} กก.`;
    case "materialTransfer":
      return `ใบส่งวัสดุ ${on} · ${e.values.material} ${fmt(n(e.values, "quantity"))} ชิ้น`;
    case "smokeOrder":
      return `PO รมควัน ${e.values.orderNumber || on}`;
    case "smokingInvoice":
      return `Invoice ค่ารมควัน ${e.values.invoiceNumber || on}`;
    case "foodivaConfirm":
      return `Invoice เนื้อ ${e.values.invoiceNo || on}`;
    case "receive":
    case "thaw":
      return `${titles[e.kind]} ${on} · ${e.branch} ${fmt(n(e.values, "kg"))} กก.`;
    default:
      return `${titles[e.kind] || e.kind} ${on}${
        branchMeatKinds.includes(e.kind) || e.kind === "materialConfirm"
          ? ` · ${e.branch}`
          : ""
      }`;
  }
}

/** A smoke PO's `lines` JSON as one "PO-2026-0001 × 300.00 กก." per line. */
function lineNames(db: Database | undefined, value: string) {
  try {
    const lines: { lotId?: string; kg?: string }[] = JSON.parse(value);
    return lines
      .map((line) => {
        const po = db?.lots.find((l) => l.id === line.lotId)?.poId;
        return `${po || line.lotId} × ${fmt(Number(line.kg))} กก.`;
      })
      .join("\n");
  } catch {
    return value;
  }
}

/** Value keys that hold another entry's id. */
const entryRefKeys = [
  "orderId",
  "invoiceId",
  "allocation",
  "transferId",
  "targetId",
  "requestId",
  "receiveId",
  "prepareId",
];

/** The display text for one value, or `undefined` when it is not a reference. */
export function referenceText(
  db: Database | undefined,
  key: string,
  value: string,
) {
  if (key === "lines") return lineNames(db, value);
  if (key === "lotId") return lotName(db, value);
  if (entryRefKeys.includes(key))
    return entryName(db, value) ?? "เอกสารที่บัญชีนี้ไม่เห็น";
  return undefined;
}

/** LNK-03: kinds a `link` may tie to a batch (branch meat) or a transfer (materialConfirm). */
export const linkableKinds: EntryKind[] = [
  ...branchMeatKinds,
  "materialConfirm",
];

/** LNK-01: the Owner links anything linkable; a role only its own entries (a branch, its own branch's). */
export const canLink = (e: Entry, role: Entry["role"], branch: string) =>
  linkableKinds.includes(e.kind) &&
  (role === "owner" ||
    (role === e.role && (role !== "branch" || e.branch === branch)));

/** The live `link` on an entry (latest wins, voided ones skipped), if any. */
export const linkOf = (db: Database | undefined, id: string) =>
  db
    ? entries(db, "link")
        .filter((l) => l.values.targetId === id)
        .at(-1)
    : undefined;

/** Is it tied to its source yet: branch meat to a batch, a material receipt to a transfer. */
export const isLinked = (e: Entry) =>
  e.kind === "materialConfirm" ? !!e.values.transferId : !!e.lotId;
