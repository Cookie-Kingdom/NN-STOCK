/** The rows of the four printable documents (V2-DOC-01), as label and value pairs for
 *  `DocumentPrintButton`. The buyer block comes from Settings; a PO เนื้อ may override each
 *  line of it (V2-PO-03). */
import { dateLabel, fmt } from "@/lib/format";
import {
  dispatchLines,
  entries,
  type Database,
  type Entry,
  type Lot,
  type Values,
} from "@/lib/store";
import { linesText } from "./noteText";

type DocumentRows = [string, string][];
/** What a document is built from: a saved entry, or a draft's date and values. */
type Note = Pick<Entry, "date" | "values">;

const kg = (value = "") => (value ? `${fmt(Number(value))} กก.` : "—");

/** The company block and logo: the head of every document. `own`: a PO เนื้อ's values, whose
 *  customerName, customerAddress, attention, phone and taxId win over Settings when typed. */
const company = (db: Database, own: Values = {}): DocumentRows => [
  ["ลูกค้า", own.customerName || db.config.companyName || "—"],
  ["ที่อยู่", own.customerAddress || db.config.companyAddress || "—"],
  ["Attention", own.attention || db.config.attention || "—"],
  ["โทร.", own.phone || db.config.companyPhone || "—"],
  ["Tax ID", own.taxId || db.config.taxId || "—"],
  // A storage key (`branding/…`), or a data URL saved before the move; the print button loads it.
  ["โลโก้", db.config.logoStorageKey || db.config.logoData || ""],
];

/** Settings holds a contact and an address for Foodiva and for Chef House only (`key` is
 *  `foodiva` or `chefHouse`): another seller prints without them. */
const seller = (db: Database, name: string, key: string): DocumentRows => {
  const known = name.replace(/\s/g, "").toLowerCase() === key.toLowerCase();
  return [
    ["Supplier", name || "—"],
    ["ผู้รับออเดอร์", (known && db.config[`${key}Contact`]) || "—"],
    ["ที่อยู่ผู้ให้บริการ", (known && db.config[`${key}Address`]) || "—"],
  ];
};

/** PO ซื้อเนื้อ, from the PO's `purchase` note (saved, or a draft's values). */
export function purchaseOrderRows(db: Database, purchase: Note): DocumentRows {
  const v = purchase.values;
  const priced = v.orderedKg && v.price;
  return [
    ...company(db, v),
    ...seller(db, v.supplier ?? "", "foodiva"),
    ["วันที่ PO", purchase.date],
    [
      "สินค้า",
      [v.productName || "เนื้อวัว", v.productCode].filter(Boolean).join(" · "),
    ],
    ["ขนาดบรรจุ", v.packSize || "—"],
    ["จำนวน", kg(v.orderedKg)],
    // Recorded so the Owner waits for it; never charged (the total is meat kg × price).
    ["Waste", v.wasteKg ? `${kg(v.wasteKg)} (ไม่คิดเงิน)` : "—"],
    ["ราคา / กก.", v.price ? `฿${fmt(Number(v.price))}` : "—"],
    [
      "ยอดรวมก่อน VAT",
      priced ? `฿${fmt(Number(v.orderedKg) * Number(v.price))}` : "—",
    ],
    ["อ้างอิงผู้ขาย", v.reference || "—"],
    ["หมายเหตุ", v.note || "—"],
  ];
}

/** "N กล่องรับเข้า · X กก." of a Packing List, either part left out when it was not jotted. */
const packingSummary = (list: Entry | undefined) =>
  [
    list?.values.boxCount && `${list.values.boxCount} กล่องรับเข้า`,
    list?.values.slicedNetKg && kg(list.values.slicedNetKg),
  ]
    .filter(Boolean)
    .join(" · ");

/** The Smoking Service PO (PO รมควัน), from its `smokeOrder` note: the kg of smoking bought,
 *  the service rate and its estimate. `lot`: the PO รมควัน it opened (none for a draft). */
export function smokeOrderPrintRows(
  db: Database,
  lot: Lot | undefined,
  order: Note,
): DocumentRows {
  const v = order.values;
  const list = lot && entries(db, "packingList", lot.id).at(-1);
  const money = (value = "") => (value ? `฿${fmt(Number(value))}` : "—");
  return [
    ...company(db),
    ...seller(db, v.smoker || "Chef House", "chefHouse"),
    ["วันที่ PO", v.requestedSmokeDate || order.date],
    ["กำหนดเสร็จ", v.expectedFinishedDate || "—"],
    // The print's smoke layout reads this label for the PO รมควัน number.
    ["เลขที่การส่ง", lot?.poId || v.orderNumber || "—"],
    ["Packing List", packingSummary(list) || "—"],
    ["สินค้า", "บริการรมควันเนื้อ"],
    [
      "ขนาดบรรจุ",
      list?.values.boxCount ? `${list.values.boxCount} กล่องรับเข้า` : "—",
    ],
    ["จำนวน", kg(v.rawKg)],
    ["ราคา / กก.", money(v.serviceRate)],
    ["ยอดรวมก่อน VAT", money(v.estimatedCost)],
    ["หมายเหตุ", v.instruction || "—"],
  ];
}

/** Packing List of a Lot, from one `packingList` note. */
export function packingListRows(
  db: Database,
  lot: Lot,
  list: Entry,
): DocumentRows {
  const v = list.values;
  return [
    ...company(db),
    ["วันที่", dateLabel(list.date)],
    ["PO รมควัน", lot.poId],
    ["เลข Invoice", v.invoiceNo || "—"],
    ["สินค้า", v.product || "—"],
    ["รหัสสินค้า", v.code || "—"],
    ["กล่องรับเข้า", v.boxCount ? `${v.boxCount} กล่อง` : "—"],
    ["น้ำหนักส่งรวม", kg(v.slicedNetKg)],
    ["Inv. Weight", kg(v.invWeightKg)],
    ["ไฟล์ Packing List", v.attachment || "—"],
    ["หมายเหตุ", v.note || "—"],
  ];
}

export const transportDocumentTitle = {
  dispatch: "ใบขนส่งเนื้อขาไป",
  return: "ใบขนส่งเนื้อขากลับ",
};

/** ใบขนส่ง of one truck: a `dispatch` (to the smoker, with every PO เนื้อ its meat is from
 *  and the kg of each) or a `return` note. */
export function transportDocumentRows(
  db: Database,
  lot: Lot,
  trip: Entry,
): DocumentRows {
  const v = trip.values;
  const out = trip.kind === "dispatch";
  const po: DocumentRows = out
    ? [["PO เนื้อ", linesText(db, dispatchLines(v)) || "—"]]
    : [];
  return [
    ...company(db),
    [
      "วันที่รถรับ",
      [dateLabel(trip.date), out ? v.pickupTime : v.returnTime]
        .filter(Boolean)
        .join(" · "),
    ],
    ["PO รมควัน", lot.poId],
    ...po,
    ["ต้นทาง", v.origin || "—"],
    ["ปลายทาง", v.destination || "—"],
    ["น้ำหนักส่ง", kg(out ? v.dispatchKg : v.returnKg)],
    ["ประเภทรถ", v.vehicleType || "—"],
    ["ทะเบียนรถ", v.plate || "—"],
    ["คนขับ", v.driverName || "—"],
    ["เบอร์ติดต่อ", v.driverPhone || "—"],
    ["หมายเหตุ", v.note || "—"],
  ];
}
