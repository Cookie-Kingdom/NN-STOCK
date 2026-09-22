import { branches, materials, riceSources, type Values } from "./store";
export type Field = {
  key: string;
  label: string;
  type?:
    | "number"
    | "text"
    | "tel"
    | "date"
    | "time"
    | "textarea"
    | "select"
    | "location"
    | "file"
    | "files";
  options?: string[];
  optional?: boolean;
  hint?: string;
  accept?: string;
  integer?: boolean;
  zero?: boolean;
  /** Fixed-length digit string (a tax id): numeric keypad and a length cap. */
  digits?: number;
  /** A date that records something that already happened: the picker stops at today. */
  past?: boolean;
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
/** Phone number: `type=tel` is what puts a phone keypad on a phone. */
const tel = (key: string, label: string): Field => ({
  key,
  label,
  type: "tel",
});
const location = (key: string, label: string): Field => ({
  key,
  label,
  type: "location",
  options: ["เชียงใหม่", "กรุงเทพฯ", "อื่น ๆ"],
});
const date = (key: string, label: string, past = false): Field => ({
  key,
  label,
  type: "date",
  past,
});
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
/** The first half-hour slot after `now`, Bangkok time — a pickup time that needs no typing. */
export function nextTimeSlot(now = new Date()) {
  const [hour, minute] = now
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hourCycle: "h23" })
    .split(":")
    .map(Number);
  return timeSlots[(hour * 2 + (minute < 30 ? 1 : 2)) % 48];
}
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
/** Payment slips: several files, saved as JSON `[{ name, storageKey }]` (see `uploadedFiles`). */
const slips: Field = {
  key: "slips",
  label: "แนบสลิปการชำระ",
  type: "files",
  optional: true,
  accept: ".pdf,image/*",
  hint: "เลือกได้หลายไฟล์พร้อมกัน ไม่บังคับ",
};
export type UploadedFile = { name: string; storageKey: string };
/** A `files` field's stored value; anything unreadable is no files. */
export function uploadedFiles(value?: string): UploadedFile[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((file) => file?.name && file?.storageKey)
      : [];
  } catch {
    return [];
  }
}
export const forms: Record<string, Field[]> = {
  materialReceive: [
    date("purchaseDate", "วันที่ซื้อวัสดุ", true),
    {
      key: "material",
      label: "วัสดุที่ซื้อเข้าคลัง (Material)",
      type: "select",
      options: materials,
    },
    number("quantity", "จำนวนที่ซื้อ · ชิ้น", false, true),
    number("unitPrice", "ราคาซื้อจริงต่อหน่วย · บาท/ชิ้น", true),
    text("supplier", "ผู้จำหน่าย (Supplier)"),
    text("reference", "เลขอ้างอิง / ใบเสร็จ", true),
    note,
  ],
  ownerWasteReceive: [
    date("receivedDate", "วันที่ Owner รับเนื้อ", true),
    number("receivedKg", "น้ำหนักรับจริง (กก.)"),
    text("receiver", "ผู้รับเนื้อ"),
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
    text("supplier", "ผู้ขาย · Foodiva"),
    text("customerName", "ชื่อบริษัท / ลูกค้า"),
    {
      key: "customerAddress",
      label: "ที่อยู่บริษัท / ที่อยู่ออก PO",
      type: "textarea",
    },
    text("attention", "ชื่อผู้ติดต่อ (Attention)"),
    tel("phone", "เบอร์ติดต่อ"),
    { key: "taxId", label: "เลขประจำตัวผู้เสียภาษี", digits: 13 },
    text("packSize", "ขนาดบรรจุ เช่น 6 ชิ้นต่อถุง"),
    text("productName", "รายการสินค้า"),
    text("productCode", "รหัสสินค้า (เก็บหลังบ้าน / ไม่บังคับ)", true),
    number("orderedKg", "น้ำหนักสั่งซื้อ (กก.)"),
    number("price", "ราคาเนื้อ / กก. (บาท)"),
    text("reference", "เลขอ้างอิงผู้ขาย", true),
    note,
  ],
  smokeOrder: [
    text("smoker", "โรงรม / ผู้ให้บริการ"),
    {
      ...number("rawKg", "น้ำหนัก PO รมควัน (กก.)"),
      hint: "ตั้งต้นจากยอดรวม Packing List แก้ได้ถ้าจะสั่งรมไม่เท่ายอดนั้น",
    },
    date("requestedSmokeDate", "วันที่ขอรมควัน"),
    {
      key: "instruction",
      label: "คำสั่งพิเศษ",
      type: "textarea",
      optional: true,
    },
    date("expectedFinishedDate", "วันที่คาดว่าจะเสร็จ"),
  ],
  smokeOrderAccept: [text("acceptedBy", "ชื่อผู้รับ PO ของ Chef House"), note],
  smokingInvoice: [
    text("invoiceNumber", "เลข Invoice ค่ารมควัน"),
    date("invoiceDate", "วันที่ Invoice", true),
    {
      ...number("netPayable", "ยอดเรียกเก็บค่ารมควัน (บาท)"),
      hint: "ตั้งต้นจากน้ำหนัก PO รมควัน × อัตราค่ารม แก้ให้ตรงกับใบวางบิลจริงได้",
    },
    {
      key: "attachment",
      label: "แนบไฟล์ Invoice ค่ารมควัน",
      type: "file",
      accept: ".pdf,image/*",
      hint: "เลือกไฟล์ PDF หรือรูปภาพใบวางบิลของ Chef House",
    },
    {
      key: "invoiceDetail",
      label: "รายละเอียดเพิ่มเติม",
      type: "textarea",
      optional: true,
    },
  ],
  invoiceReview: [
    {
      key: "decision",
      label: "ผลการตรวจยอด",
      type: "select",
      options: ["รับยอด", "ส่งกลับแก้ไข"],
    },
    text("reviewedBy", "ชื่อผู้ตรวจ"),
    {
      key: "comment",
      label: "หมายเหตุถึง Chef House",
      type: "textarea",
      optional: true,
    },
  ],
  invoicePayment: [
    date("paymentDate", "วันที่ชำระเงิน", true),
    number("paidAmount", "ยอดชำระ (บาท)"),
    text("paidBy", "ผู้ดำเนินการชำระ"),
    text("paymentReference", "เลขอ้างอิงการชำระ", true),
    slips,
    note,
  ],
  meatPayment: [
    date("paymentDate", "วันที่ชำระเงิน", true),
    number("paidAmount", "ยอดชำระ (บาท)"),
    text("paidBy", "ผู้ดำเนินการชำระ"),
    text("paymentReference", "เลขอ้างอิงการชำระ", true),
    slips,
    note,
  ],
  foodivaConfirm: [
    text("invoiceNo", "เลข Invoice เนื้อ"),
    date("invoiceDate", "วันที่ Invoice", true),
    number("confirmedKg", "น้ำหนักตาม Invoice (กก.)"),
    number("readyForChiangMaiKg", "พร้อมส่งไป Chef House · เชียงใหม่ (กก.)"),
    number("reservedForOwnerKg", "เนื้อส่วนที่เหลือรอ Owner รับ (Waste)", true),
    number("invoiceAmount", "ยอดรวม Invoice (บาท)", true),
    {
      key: "attachment",
      label: "อัปโหลด Invoice เนื้อ",
      type: "file",
      accept: ".pdf,image/*",
      hint: "เลือกไฟล์ PDF หรือรูปภาพของ Invoice",
    },
    text("confirmedBy", "ชื่อผู้ยืนยันจาก Foodiva"),
    note,
  ],
  dispatch: [
    date("pickupDate", "วันที่รถรับ"),
    location("origin", "ต้นทาง (Origin)"),
    location("destination", "ปลายทาง (Destination)"),
    {
      key: "trip",
      label: "รูปแบบเที่ยวรถ",
      type: "select",
      options: ["เที่ยวเดียว", "ไปกลับ"],
    },
    { key: "pickupTime", label: "เวลารถรับ", type: "time" },
    text("vehicleType", "ประเภทรถ"),
    text("plate", "ทะเบียนรถ"),
    text("driverName", "ชื่อคนขับ"),
    tel("driverPhone", "เบอร์ติดต่อคนขับ"),
    number("dispatchKg", "น้ำหนักตาม Request (กก.)"),
    note,
  ],
  cmReceive: [{ key: "arrival", label: "เวลาที่รถมาถึง", type: "time" }, note],
  prepare: [number("preSmokeKg", "น้ำหนักหลังแกะซับ ก่อนสโมค (กก.)"), note],
  smoke: [
    date("smokeDate", "วันที่สโมค", true),
    number("inputKg", "น้ำหนักเข้าเตารอบนี้ (กก.)"),
    number("wasteKg", "น้ำหนัก Waste (กก.)", true),
    {
      key: "packs",
      label: "น้ำหนักกล่องรมควัน (กก./กล่องรมควัน)",
      type: "textarea",
      hint: "กรอกว่ากล่องรมควันนี้กี่กิโล ทีละกล่องรมควัน ระบบจะรวมจำนวนกล่องรมควันและน้ำหนักให้อัตโนมัติ โดยยังไม่ต้องแบ่งเป็นซีลขาย",
    },
    note,
  ],
  closeLot: [text("confirm", "ชื่อผู้ยืนยันปิด Lot"), note],
  return: [
    date("returnDate", "วันที่รถรับจาก Chef House"),
    { key: "returnTime", label: "เวลารถรับ", type: "time" },
    location("origin", "ต้นทาง (Origin)"),
    location("destination", "ปลายทาง (Destination)"),
    text("vehicleType", "ประเภทรถ"),
    text("plate", "ทะเบียนรถ"),
    text("driverName", "ชื่อคนขับ"),
    tel("driverPhone", "เบอร์ติดต่อคนขับ"),
    number("returnKg", "น้ำหนักส่งจาก Chef House (กก.)"),
    note,
  ],
  foodivaReturnReceive: [
    date("receivedDate", "วันที่ Foodiva รับเนื้อรมควัน", true),
    { key: "receivedTime", label: "เวลารับ", type: "time" },
    number("receivedKg", "น้ำหนักรับจริง (กก.)"),
    number("receivedBags", "จำนวนกล่องรมควันที่รับ", false, true),
    reason,
    note,
  ],
  central: [number("centralKg", "น้ำหนักรับสต๊อกกลาง (กก.)"), reason, note],
  allocate: [
    { key: "branch", label: "สาขาปลายทาง", type: "select", options: branches },
    number("kg", "น้ำหนักจัดสรร (กก.)"),
    date("deliveryDate", "วันที่ส่งสาขา"),
    reason,
    note,
  ],
  receive: [number("kg", "น้ำหนักรับเข้าสาขา (กก.)"), reason, note],
  thaw: [
    number("kg", "น้ำหนักละลาย (กก.)"),
    number("bags", "จำนวนถุงที่ละลาย", false, true),
    reason,
    note,
  ],
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
    {
      key: "riceSource",
      label: "รอบนี้ข้าวเหนียวมาจาก (Rice source)",
      type: "select",
      options: riceSources,
    },
    text("supplier", "ผู้จำหน่ายข้าว (Rice supplier)"),
    number("rawRiceKg", "ข้าวเหนียวดิบซื้อเข้า (Raw sticky rice) · กก.", true),
    number("rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ (Purchase cost) · บาท", true),
    number(
      "cookedRiceKg",
      "ข้าวเหนียวสุกซื้อเข้า (Cooked sticky rice) · กก.",
      true,
    ),
    number(
      "cookedRiceCost",
      "ยอดซื้อข้าวเหนียวสุก (Purchase cost) · บาท",
      true,
    ),
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
  chiliAllocate: [
    {
      key: "branch",
      label: "สาขาปลายทาง (Destination branch)",
      type: "select",
      options: branches,
    },
    number("chiliTubes", "จำนวนน้ำพริกที่จัดสรร · หลอด", false, true),
    text("receiver", "ผู้รับ / ผู้ดูแลสาขา", true),
    text("reference", "เลขที่อ้างอิงใบส่งของ", true),
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
    number(
      "rawRiceIssuedKg",
      "ข้าวเหนียวดิบที่เบิกวันนี้ (Raw rice issued) · กก.",
    ),
    text("receiver", "ผู้รับของ (Receiver)"),
    note,
  ],
  chiliIssue: [
    number(
      "chiliIssuedTubes",
      "น้ำพริกที่เบิกวันนี้ (Chili issued) · หลอด",
      false,
      true,
    ),
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
    number(
      "boxes",
      "กล่องมาตรฐาน · เนื้อ 1 ซีล + ข้าว 200 กรัม (กล่อง)",
      true,
      true,
    ),
    number("addons", "เนื้อซีล Add-on · 320 บาท (แพ็ก)", true, true),
    number("chiliAddons", "น้ำพริกหลอด · จำหน่ายแยก 30 บาท (หลอด)", true, true),
    {
      ...number(
        "chiliCount",
        "ตรวจนับน้ำพริกจริงปลายวัน · หลอด (เว้นว่างถ้าไม่ได้นับ)",
        true,
      ),
      optional: true,
    },
    {
      key: "chiliRemark",
      label: "หมายเหตุเมื่อน้ำพริกไม่ตรง",
      type: "textarea",
      optional: true,
    },
    number(
      "soldKg",
      "น้ำหนักเนื้อซีลพร้อมขายจาก Lot นี้ (กก. · 100–103 กรัม/ซีล)",
      true,
    ),
    number("wasteKg", "Waste เนื้อจาก Lot นี้ (กก.)", true),
    number("riceWasteKg", "Waste ข้าว (กก.)", true),
    number("lineMan", "ยอดขาย LINE MAN ที่บันทึก (บาท)", true),
    number("expense", "ค่าใช้จ่ายสาขา (บาท)", true),
    text("payer", "ผู้จ่ายเงิน / สำรองจ่าย", true),
    { ...reason, hint: "ต้องกรอกเมื่อมี Waste เนื้อหรือข้าว" },
    note,
  ],
  influencerBox: [
    text("influencer", "ชื่ออินฟลูเอนเซอร์ / ช่อง"),
    number(
      "boxes",
      "กล่องมาตรฐานที่ส่ง · เนื้อ 1 ซีล + ข้าว 200 กรัม (กล่อง)",
      true,
      true,
    ),
    number("addons", "เนื้อซีลเพิ่ม (แพ็ก)", true, true),
    number("chiliAddons", "น้ำพริกหลอด (หลอด)", true, true),
    number(
      "soldKg",
      "น้ำหนักเนื้อที่ส่งจาก Lot นี้ (กก. · 100–103 กรัม/ซีล)",
      true,
    ),
    number("shippingFee", "ค่าส่ง (บาท)", true),
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
      hint: "ปิดวันได้ตั้งแต่เวลาเริ่มปิดวันในตั้งค่า ปรับเวลาจำลองเพื่อทดสอบเงื่อนไข",
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
      label: "สาขาเริ่มต้น (Default branch)",
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
      "จำนวนฐานข้าวเหนียวสุก (Cooked rice par level) · กก.",
      true,
    ),
    number(
      "cookedRiceUnitPrice",
      "ราคาต่อหน่วยข้าวเหนียวสุก (Cooked rice unit price) · บาท/กก.",
      true,
    ),
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
/** The Owner's ready-made ingredient picks. Raw sticky rice is no longer one: each branch
 *  buys (or cooks) its own rice (B2). Older entries that name it still display as saved. */
export const standardIngredients = ["น้ำพริกหลอด", "น้ำดอง"];

export function defaults(kind: string, dateValue: string): Values {
  const out: Values = {};
  for (const f of forms[kind] || [])
    out[f.key] =
      f.type === "date"
        ? dateValue
        : f.type === "select"
          ? f.options![0]
          : f.type === "number" && f.zero && !f.optional
            ? "0"
            : "";
  if (kind === "purchase") out.supplier = "Foodiva";
  // Picked on every purchase, never preselected: a wrong default would book the wrong stock.
  if (kind === "ricePurchase") out.riceSource = "";
  if (kind === "dispatch")
    Object.assign(out, { origin: "กรุงเทพฯ", destination: "เชียงใหม่" });
  if (kind === "return")
    Object.assign(out, { origin: "เชียงใหม่", destination: "กรุงเทพฯ" });
  return out;
}
