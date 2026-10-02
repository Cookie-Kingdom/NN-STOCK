/** The rows of the four printable documents (V2-DOC-01), as label and value pairs for
 *  `DocumentPrintButton`. The buyer block always comes from Settings (V2-PO-03). */
import { dateLabel, fmt } from "@/lib/format";
import { entries, type Database, type Entry, type Lot } from "@/lib/store";
import { lotLabel } from "./noteText";

export type DocumentRows = [string, string][];

const kg = (value = "") => (value ? `${fmt(Number(value))} กก.` : "—");

/** The company block and logo: the head of every document. */
const company = (db: Database): DocumentRows => [
  ["ลูกค้า", db.config.companyName || "—"],
  ["ที่อยู่", db.config.companyAddress || "—"],
  ["Attention", db.config.attention || "—"],
  ["โทร.", db.config.companyPhone || "—"],
  ["Tax ID", db.config.taxId || "—"],
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

/** PO ซื้อเนื้อ, from the PO's `purchase` note. */
export function purchaseOrderRows(db: Database, purchase: Entry): DocumentRows {
  const v = purchase.values;
  const priced = v.orderedKg && v.price;
  return [
    ...company(db),
    ...seller(db, v.supplier ?? "", "foodiva"),
    ["วันที่ PO", purchase.date],
    [
      "สินค้า",
      [v.productName || "เนื้อวัว", v.productCode].filter(Boolean).join(" · "),
    ],
    ["ขนาดบรรจุ", v.packSize || "—"],
    ["จำนวน", kg(v.orderedKg)],
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

/** PO รมควัน, from one `smokeOrder` note. The smoker reads it, so it names the Lot and its
 *  Packing List, never a PO เนื้อ or a meat price. */
export function smokeOrderPrintRows(
  db: Database,
  lot: Lot,
  order: Entry,
): DocumentRows {
  const v = order.values;
  const list = entries(db, "packingList", lot.id).at(-1);
  return [
    ...company(db),
    ...seller(db, v.smoker || "Chef House", "chefHouse"),
    ["วันที่ PO", v.requestedSmokeDate || order.date],
    ["กำหนดเสร็จ", v.expectedFinishedDate || "—"],
    ["เลขที่การส่ง", lot.poId],
    ["Packing List", packingSummary(list) || "—"],
    ["สินค้า", "บริการรมควันเนื้อ"],
    [
      "ขนาดบรรจุ",
      list?.values.boxCount ? `${list.values.boxCount} กล่องรับเข้า` : "—",
    ],
    ["จำนวน", kg(v.rawKg)],
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
    ["เลขที่การส่ง", lot.poId],
    ["เลข Invoice", v.invoiceNo || "—"],
    ["สินค้า", v.product || "—"],
    ["CODE สินค้า", v.code || "—"],
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

/** ใบขนส่ง of one truck: a `dispatch` (to the smoker, with the PO เนื้อ its meat is from) or
 *  a `return` note. */
export function transportDocumentRows(
  db: Database,
  lot: Lot,
  trip: Entry,
): DocumentRows {
  const v = trip.values;
  const out = trip.kind === "dispatch";
  const po: DocumentRows = out
    ? [["PO เนื้อ", v.poLotId ? lotLabel(db, v.poLotId) : "—"]]
    : [];
  return [
    ...company(db),
    [
      "วันที่รถรับ",
      [dateLabel(trip.date), out ? v.pickupTime : v.returnTime]
        .filter(Boolean)
        .join(" · "),
    ],
    ["เลขที่การส่ง", lot.poId],
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
