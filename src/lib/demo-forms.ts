import { branches, materials, type Values } from "./demo-store";
export type Field = {
  key: string;
  label: string;
  type?: "number" | "text" | "date" | "time" | "textarea" | "select";
  options?: string[];
  optional?: boolean;
  hint?: string;
  integer?: boolean;
  zero?: boolean;
};
const number = (
  key: string,
  label: string,
  zero = false,
  integer = false,
): Field => ({ key, label, type: "number", zero, integer });
const text = (key: string, label: string, optional = false): Field => ({
  key,
  label,
  optional,
});
const date = (key: string, label: string): Field => ({
  key,
  label,
  type: "date",
});
const reason: Field = {
  key: "reason",
  label: "เหตุผลส่วนต่าง / Waste / ข้าม FIFO",
  type: "textarea",
  optional: true,
};
const note: Field = {
  key: "note",
  label: "หมายเหตุ",
  type: "textarea",
  optional: true,
};
export const forms: Record<string, Field[]> = {
  materialReceive: [
    {
      key: "material",
      label: "วัสดุที่รับเข้าคลัง (Material)",
      type: "select",
      options: materials,
    },
    number("quantity", "จำนวนรับเข้าคลัง Owner · ชิ้น", false, true),
    number("unitPrice", "ราคาต่อหน่วย · บาท/ชิ้น", true),
    text("supplier", "ผู้จำหน่าย (Supplier)"),
    text("reference", "เลขอ้างอิง / ใบเสร็จ", true),
    note,
  ],
  materialTransfer: [
    {
      key: "material",
      label: "วัสดุที่ส่ง (Material)",
      type: "select",
      options: materials,
    },
    {
      key: "branch",
      label: "สาขาปลายทาง (Destination branch)",
      type: "select",
      options: branches,
    },
    number("quantity", "จำนวนที่ส่ง · ชิ้น", false, true),
    text("receiver", "ผู้รับของ (Receiver)"),
    text("reference", "เลขที่ใบส่งของ", true),
    note,
  ],
  purchase: [
    text("supplier", "ผู้ขาย"),
    number("orderedKg", "น้ำหนักสั่งซื้อ (กก.)"),
    number("price", "ราคาเนื้อ / กก. (บาท)"),
    text("reference", "เลขอ้างอิงผู้ขาย", true),
    note,
  ],
  dispatch: [
    date("pickupDate", "วันที่รถรับ"),
    text("origin", "ต้นทาง"),
    text("destination", "ปลายทาง"),
    {
      key: "trip",
      label: "รูปแบบเที่ยวรถ",
      type: "select",
      options: ["เที่ยวเดียว", "ไปกลับ"],
    },
    text("vehicle", "ทะเบียนรถ / ผู้ขนส่ง"),
    number("dispatchKg", "น้ำหนักที่ส่งเที่ยวนี้ (กก.)"),
    note,
  ],
  cmReceive: [
    { key: "arrival", label: "เวลาถึง", type: "time" },
    number("receivedKg", "น้ำหนักรับจริง (กก.)"),
    reason,
    note,
  ],
  prepare: [number("preKg", "น้ำหนักหลังแกะซับ ก่อนสโมค (กก.)"), note],
  smoke: [
    date("smokeDate", "วันที่สโมค"),
    number("inputKg", "น้ำหนักเข้าเตารอบนี้ (กก.)"),
    number("brineKg", "น้ำหมักที่ใช้ (กก.)", true),
    {
      key: "packs",
      label: "น้ำหนักแต่ละแพ็ก (กก.)",
      type: "textarea",
      hint: "หนึ่งแพ็กต่อบรรทัด หรือคั่นด้วยจุลภาค ระบบรวมให้อัตโนมัติ เช่น 0.5, 0.48, 0.52",
    },
    note,
  ],
  closeLot: [text("confirm", "ชื่อผู้ยืนยันปิด Lot"), note],
  return: [
    date("returnDate", "วันที่นัดรับขากลับ"),
    text("returnVehicle", "รถ / ผู้ขนส่งขากลับ"),
    note,
  ],
  central: [number("centralKg", "น้ำหนักรับสต๊อกกลาง (กก.)"), reason, note],
  allocate: [
    { key: "branch", label: "สาขาปลายทาง", type: "select", options: branches },
    number("kg", "น้ำหนักจัดสรร (กก.)"),
    number("bags", "จำนวนถุง", false, true),
    date("deliveryDate", "วันที่ส่งสาขา"),
    reason,
    note,
  ],
  receive: [
    number("kg", "น้ำหนักรับเข้าสาขา (กก.)"),
    number("bags", "จำนวนถุงที่รับ", false, true),
    reason,
    note,
  ],
  thaw: [number("kg", "น้ำหนักละลาย (กก.)"), reason, note],
  supplyPurchase: [
    text("supplier", "ผู้จำหน่าย (Supplier)"),
    number("rawRiceKg", "ข้าวเหนียวดิบซื้อเข้า (Raw sticky rice) · กก.", true),
    number(
      "rawRiceCost",
      "ยอดซื้อข้าวเหนียวดิบ (Rice purchase cost) · บาท",
      true,
    ),
    number(
      "cookedRiceKg",
      "ข้าวเหนียวสุกซื้อเข้า (Cooked sticky rice) · กก.",
      true,
    ),
    number(
      "cookedRiceCost",
      "ยอดซื้อข้าวเหนียวสุก (Cooked rice purchase cost) · บาท",
      true,
    ),
    number("chiliTubes", "น้ำพริกซื้อเข้า (Chili paste) · หลอด", true, true),
    number("chiliCost", "ยอดซื้อน้ำพริก (Chili purchase cost) · บาท", true),
    text("reference", "เลขที่ใบเสร็จ / ใบส่งของ (Reference)", true),
    note,
  ],
  ricePurchase: [
    text("supplier", "ผู้จำหน่ายข้าว (Rice supplier)"),
    number("rawRiceKg", "ข้าวเหนียวดิบซื้อเข้า (Raw sticky rice) · กก.", true),
    number("rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ (Purchase cost) · บาท", true),
    number("cookedRiceKg", "ข้าวเหนียวสุกซื้อเข้า (Cooked sticky rice) · กก.", true),
    number("cookedRiceCost", "ยอดซื้อข้าวเหนียวสุก (Purchase cost) · บาท", true),
    text("reference", "เลขที่ใบเสร็จ (Reference)", true),
    note,
  ],
  chiliPurchase: [
    text("supplier", "ผู้จำหน่ายน้ำพริก (Chili supplier)"),
    number("chiliTubes", "น้ำพริกซื้อเข้า (Chili paste) · หลอด", false, true),
    number("chiliCost", "ยอดซื้อน้ำพริก (Purchase cost) · บาท"),
    text("reference", "เลขที่ใบเสร็จ (Reference)", true),
    note,
  ],
  supplyIssue: [
    number(
      "rawRiceIssuedKg",
      "ข้าวเหนียวดิบที่เบิกวันนี้ (Raw rice issued) · กก.",
      true,
    ),
    number(
      "chiliIssuedTubes",
      "น้ำพริกที่เบิกวันนี้ (Chili issued) · หลอด",
      true,
      true,
    ),
    text("receiver", "ผู้รับของ (Receiver)"),
    note,
  ],
  riceIssue: [
    number("rawRiceIssuedKg", "ข้าวเหนียวดิบที่เบิกวันนี้ (Raw rice issued) · กก."),
    text("receiver", "ผู้รับของ (Receiver)"),
    note,
  ],
  chiliIssue: [
    number("chiliIssuedTubes", "น้ำพริกที่เบิกวันนี้ (Chili issued) · หลอด", false, true),
    text("receiver", "ผู้รับของ (Receiver)"),
    note,
  ],
  rice: [
    number("rawUsedKg", "ข้าวเหนียวดิบที่นำมาหุง (Raw rice used) · กก."),
    number("riceKg", "ข้าวเหนียวสุกที่ได้ (Cooked rice output) · กก."),
    note,
  ],
  riceCarry: [
    number(
      "leftoverKg",
      "ข้าวเหนียวสุกเหลือปลายวัน (Cooked rice leftover) · กก.",
      true,
    ),
    {
      key: "reheat",
      label: "การจัดการวันถัดไป (Next-day handling)",
      type: "select",
      options: ["เก็บไว้อุ่นวันถัดไป", "ไม่นำกลับมาใช้"],
    },
    reason,
    note,
  ],
  sale: [
    number("boxes", "กล่องมาตรฐาน · เนื้อ 1 ซีล + ข้าว 200 กรัม + น้ำพริกฟรี 1 หลอด (กล่อง)", true, true),
    number("addons", "เนื้อซีล Add-on · 320 บาท (แพ็ก)", true, true),
    number("chiliAddons", "น้ำพริกซื้อเพิ่ม · 30 บาท (หลอด)", true, true),
    number("soldKg", "น้ำหนักเนื้อที่ขายจาก Lot นี้ (กก.)", true),
    number("wasteKg", "Waste เนื้อจาก Lot นี้ (กก.)", true),
    number("riceWasteKg", "Waste ข้าว (กก.)", true),
    number("lineMan", "ยอดขาย LINE MAN ที่บันทึก (บาท)", true),
    number("expense", "ค่าใช้จ่ายสาขา (บาท)", true),
    text("payer", "ผู้จ่ายเงิน / สำรองจ่าย", true),
    reason,
    note,
  ],
  materials: materials.map((m, i) =>
    number("material" + i, m + " (ชิ้น)", true, true),
  ),
  closeDay: [
    {
      key: "time",
      label: "เวลาจำลองสำหรับทดสอบปิดวัน",
      type: "time",
      hint: "ปรับเป็นก่อนหรือหลัง 21:00 เพื่อทดสอบเงื่อนไข",
    },
    text("confirm", "ชื่อผู้ยืนยันปิดวัน"),
    note,
  ],
  expense: [
    {
      key: "category",
      label: "หมวดค่าใช้จ่าย",
      type: "select",
      options: [
        "ค่าเช่า",
        "อุปกรณ์ / การลงทุน",
        "ค่าสาธารณูปโภค",
        "ค่าใช้จ่ายอื่น",
      ],
    },
    number("amount", "จำนวนเงิน (บาท)"),
    text("payer", "ผู้จ่ายเงิน"),
    text("detail", "รายละเอียด / อ้างอิงการโอน"),
    note,
  ],
  unlock: [
    {
      key: "branch",
      label: "สาขาที่ปลดล็อก",
      type: "select",
      options: branches,
    },
    { key: "reason", label: "เหตุผลปลดล็อก", type: "textarea" },
  ],
  config: [
    {
      key: "branch",
      label: "สาขาของบัญชีผู้ดูแล (Assigned branch)",
      type: "select",
      options: branches,
    },
    number("boxPrice", "ราคากล่องมาตรฐาน (Standard box price) · บาท", true),
    number("addonPrice", "ราคาเนื้อซีลเพิ่ม (Add-on pack price) · บาท", true),
    number("packKg", "น้ำหนักเฉลี่ยต่อซีล (Average sealed meat weight) · กก."),
    number("ricePrice", "ราคาข้าวในกล่อง (Included rice price) · บาท", true),
    number("chiliPrice", "ราคาน้ำพริก (Chili paste price) · บาท/หลอด", true),
    number(
      "rawRicePar",
      "จำนวนฐานข้าวเหนียวดิบ (Raw rice par level) · กก.",
      true,
    ),
    number(
      "rawRiceUnitPrice",
      "ราคาต่อหน่วยข้าวเหนียวดิบ (Raw rice unit price) · บาท/กก.",
      true,
    ),
    number("chiliPar", "จำนวนฐานน้ำพริก (Chili par level) · หลอด", true, true),
    number(
      "chiliUnitPrice",
      "ราคาต่อหน่วยน้ำพริก (Chili unit price) · บาท/หลอด",
      true,
    ),
    number(
      "cookedRicePar",
      "จำนวนฐานข้าวเหนียวสุกมีนบุรี (Cooked rice par level) · กก.",
      true,
    ),
    number(
      "cookedRiceUnitPrice",
      "ราคาต่อหน่วยข้าวเหนียวสุก (Cooked rice unit price) · บาท/กก.",
      true,
    ),
    number("brinePrice", "ค่าหมัก (Brining cost) · บาท/กก.", true),
    number("smokeRate", "ค่ารมควัน (Smoking fee) · บาท/กก.", true),
    number("outboundFee", "ค่าขนส่งขาไป (Outbound delivery fee) · บาท", true),
    number("returnFee", "ค่าขนส่งขากลับ (Return delivery fee) · บาท", true),
    number("roundFee", "ค่าขนส่งไป-กลับ (Round-trip fee) · บาท", true),
    number("tolerance", "ค่าคลาดเคลื่อนยอดขาย (Sales tolerance) · %", true),
    {
      key: "closeTime",
      label: "เวลาเริ่มปิดวัน (Day-closing time)",
      type: "time",
    },
    ...materials.flatMap((m, i) => [
      number("material" + i, `จำนวนฐาน ${m} (Par level) · ชิ้น`, true, true),
      number(
        "materialPrice" + i,
        `ราคาต่อหน่วย ${m} (Unit price) · บาท/ชิ้น`,
        true,
      ),
    ]),
  ],
};
export function defaults(kind: string, dateValue: string): Values {
  const out: Values = {};
  for (const f of forms[kind] || [])
    out[f.key] =
      f.type === "date"
        ? dateValue
        : f.type === "select"
          ? f.options![0]
          : f.type === "number" && f.zero
            ? "0"
            : "";
  return out;
}
