import { branches, materials, type Values } from "./store";
export type Field = {
  key: string;
  label: string;
  type?: "number" | "text" | "date" | "time" | "textarea" | "select" | "location" | "file";
  options?: string[];
  optional?: boolean;
  hint?: string;
  accept?: string;
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
const location = (key: string, label: string): Field => ({
  key,
  label,
  type: "location",
  options: ["เชียงใหม่", "กรุงเทพฯ", "อื่น ๆ"],
});
const date = (key: string, label: string): Field => ({
  key,
  label,
  type: "date",
});
const arrivalTimes = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  return `${hour}:${index % 2 ? "30" : "00"}`;
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
    date("purchaseDate", "วันที่ซื้อวัสดุ"),
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
    date("receivedDate", "วันที่ Owner รับเนื้อ"),
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
    { key: "customerAddress", label: "ที่อยู่บริษัท / ที่อยู่ออก PO", type: "textarea" },
    text("attention", "ชื่อผู้ติดต่อ (Attention)"),
    text("phone", "เบอร์ติดต่อ"),
    text("taxId", "เลขประจำตัวผู้เสียภาษี"),
    text("packSize", "ขนาดบรรจุ เช่น 6 ชิ้นต่อถุง"),
    text("productName", "รายการสินค้า"),
    text("productCode", "รหัสสินค้า (เก็บหลังบ้าน / ไม่บังคับ)", true),
    number("orderedKg", "น้ำหนักสั่งซื้อ (กก.)"),
    number("price", "ราคาเนื้อ / กก. (บาท)"),
    text("reference", "เลขอ้างอิงผู้ขาย", true),
    note,
  ],
  supplierInvoice: [
    text("invoiceNumber", "Supplier Invoice Number"),
    date("invoiceDate", "Invoice Date"),
    number("quantityKg", "Quantity ตาม Invoice (กก.)"),
    number("amountBeforeVat", "Amount before VAT (บาท)", true),
    number("vat", "VAT (บาท)", true),
    number("totalAmount", "Total Amount (บาท)", true),
    date("dueDate", "Due Date"),
    { key: "paymentStatus", label: "สถานะชำระเงิน", type: "select", options: ["Unpaid", "Partial", "Paid"] },
    { key: "paymentDate", label: "Payment Date", type: "date", optional: true },
    text("attachment", "Attachment / File URL", true),
    note,
  ],
  taxDocument: [
    { key: "documentType", label: "ประเภทเอกสาร", type: "select", options: ["Tax Invoice", "Receipt", "Tax Invoice & Receipt"] },
    text("documentNumber", "เลขที่เอกสาร"),
    date("documentDate", "วันที่เอกสาร"),
    number("amount", "Amount (บาท)", true),
    number("vat", "VAT (บาท)", true),
    text("attachment", "Attachment / File URL", true),
    note,
  ],
  smokeOrder: [
    text("smoker", "โรงรม / ผู้ให้บริการ"),
    number("rawKg", "Raw Meat Quantity (กก.)"),
    date("requestedSmokeDate", "วันที่ขอรมควัน"),
    { key: "instruction", label: "คำสั่งพิเศษ", type: "textarea", optional: true },
    date("expectedFinishedDate", "วันที่คาดว่าจะเสร็จ"),
  ],
  smokeOrderAccept: [
    text("acceptedBy", "ชื่อผู้รับ PO ของ Chef_house"),
    note,
  ],
  smokingInvoice: [
    text("invoiceNumber", "เลข Invoice ค่ารมควัน"),
    date("invoiceDate", "วันที่ Invoice"),
    {
      key: "attachment",
      label: "แนบไฟล์ Invoice ค่ารมควัน",
      type: "file",
      accept: ".pdf,image/*",
      hint: "เลือกไฟล์ PDF หรือรูปภาพใบวางบิลของ Chef_house",
    },
    { key: "invoiceDetail", label: "รายละเอียดเพิ่มเติม", type: "textarea", optional: true },
  ],
  invoiceReview: [
    { key: "decision", label: "ผลการตรวจยอด", type: "select", options: ["รับยอด", "ส่งกลับแก้ไข"] },
    text("reviewedBy", "ชื่อผู้ตรวจ"),
    { key: "comment", label: "หมายเหตุถึง Chef_house", type: "textarea", optional: true },
  ],
  invoicePayment: [
    date("paymentDate", "วันที่ชำระเงิน"),
    number("paidAmount", "ยอดชำระ (บาท)"),
    text("paidBy", "ผู้ดำเนินการชำระ"),
    text("paymentReference", "เลขอ้างอิงการชำระ", true),
    note,
  ],
  steakTransfer: [
    date("transferDate", "Transfer Date"),
    number("quantityKg", "Quantity Out (กก.)"),
    { key: "reason", label: "เหตุผลโอน", type: "select", options: ["Steak Production", "Other"] },
    text("transportInfo", "Transport / Delivery Information", true),
    note,
  ],
  foodivaConfirm: [
    text("invoiceNo", "เลข Invoice เนื้อ"),
    date("invoiceDate", "วันที่ Invoice"),
    number("confirmedKg", "น้ำหนักตาม Invoice (กก.)"),
    number("readyForChiangMaiKg", "พร้อมส่งไป Chef_house · เชียงใหม่ (กก.)"),
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
    text("driverPhone", "เบอร์ติดต่อคนขับ"),
    number("dispatchKg", "น้ำหนักที่ส่งเที่ยวนี้ (กก.)"),
    note,
  ],
  cmReceive: [
    { key: "arrival", label: "เวลาที่รถมาถึง", type: "select", options: arrivalTimes },
    number("receivedKg", "น้ำหนักรับจริง (กก.)"),
    note,
  ],
  prepare: [number("preSmokeKg", "น้ำหนักหลังแกะซับ ก่อนสโมค (กก.)"), note],
  smoke: [
    date("smokeDate", "วันที่สโมค"),
    number("inputKg", "น้ำหนักเข้าเตารอบนี้ (กก.)"),
    number("wasteKg", "น้ำหนัก Waste (กก.)", true),
    {
      key: "packs",
      label: "น้ำหนักถุงใหญ่จาก Chef_house (กก./ถุง)",
      type: "textarea",
      hint: "กรอกน้ำหนักจริงของแต่ละถุง ระบบจะรวมจำนวนถุงและน้ำหนักให้อัตโนมัติ โดยยังไม่ต้องแบ่งเป็นซีลขาย",
    },
    note,
  ],
  closeLot: [text("confirm", "ชื่อผู้ยืนยันปิด Lot"), note],
  return: [
    date("returnDate", "วันที่รถรับจาก Chef_house"),
    { key: "returnTime", label: "เวลารถรับ", type: "time" },
    location("origin", "ต้นทาง (Origin)"),
    location("destination", "ปลายทาง (Destination)"),
    text("vehicleType", "ประเภทรถ"),
    text("plate", "ทะเบียนรถ"),
    text("driverName", "ชื่อคนขับ"),
    text("driverPhone", "เบอร์ติดต่อคนขับ"),
    number("returnKg", "น้ำหนักส่งจาก Chef_house (กก.)"),
    note,
  ],
  foodivaReturnReceive: [
    date("receivedDate", "วันที่ Foodiva รับเนื้อรมควัน"),
    { key: "receivedTime", label: "เวลารับ", type: "time" },
    number("receivedKg", "น้ำหนักรับจริง (กก.)"),
    number("receivedBags", "จำนวนถุงที่รับ", false, true),
    reason,
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
  thaw: [number("kg", "น้ำหนักละลาย (กก.)"), number("bags", "จำนวนถุงที่ละลาย", false, true), reason, note],
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
    number("boxes", "กล่องมาตรฐาน · เนื้อ 1 ซีล + ข้าว 200 กรัม (กล่อง)", true, true),
    number("addons", "เนื้อซีล Add-on · 320 บาท (แพ็ก)", true, true),
    number("chiliAddons", "น้ำพริกหลอด · จำหน่ายแยก 30 บาท (หลอด)", true, true),
    number("chiliCount", "ตรวจนับน้ำพริกจริงปลายวัน · หลอด", true, true),
    { key: "chiliRemark", label: "หมายเหตุเมื่อน้ำพริกไม่ตรง", type: "textarea", optional: true },
    number("soldKg", "น้ำหนักเนื้อซีลพร้อมขายจาก Lot นี้ (กก. · 100–103 กรัม/ซีล)", true),
    number("wasteKg", "Waste เนื้อจาก Lot นี้ (กก.)", true),
    number("riceWasteKg", "Waste ข้าว (กก.)", true),
    number("lineMan", "ยอดขาย LINE MAN ที่บันทึก (บาท)", true),
    number("expense", "ค่าใช้จ่ายสาขา (บาท)", true),
    text("payer", "ผู้จ่ายเงิน / สำรองจ่าย", true),
    reason,
    note,
  ],
  influencerBox: [
    text("influencer", "ชื่ออินฟลูเอนเซอร์ / ช่อง"),
    number("boxes", "กล่องมาตรฐานที่ส่ง · เนื้อ 1 ซีล + ข้าว 200 กรัม (กล่อง)", true, true),
    number("addons", "เนื้อซีลเพิ่ม (แพ็ก)", true, true),
    number("chiliAddons", "น้ำพริกหลอด (หลอด)", true, true),
    number("soldKg", "น้ำหนักเนื้อที่ส่งจาก Lot นี้ (กก. · 100–103 กรัม/ซีล)", true),
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
      "จำนวนฐานข้าวเหนียวสุกมีนบุรี (Cooked rice par level) · กก.",
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
  if (kind === "dispatch") Object.assign(out, { origin: "กรุงเทพฯ", destination: "เชียงใหม่" });
  if (kind === "return") Object.assign(out, { origin: "เชียงใหม่", destination: "กรุงเทพฯ" });
  return out;
}
