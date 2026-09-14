"use client";

import { Read } from "@/components/shared/primitives";
import { balance, chiliStock, entries, n, processed, produced, producedBags, smokeServiceRate, type Database, type Lot, type Values } from "@/lib/store";
import { fmt } from "@/lib/format";

export function Preview({
  db,
  lot,
  kind,
  v,
}: {
  db: Database;
  lot?: Lot;
  kind: string;
  v: Values;
}) {
  let rows: [string, string][] = [];
  if (kind === "purchase")
    rows = [
      ["ค่าเนื้อ", `฿${fmt(n(v, "orderedKg") * n(v, "price"))}`],
      ["สถานะ", "รอ Foodiva ออก Invoice ก่อนเรียกรถ"],
    ];
  if (kind === "foodDivaConfirm") {
    const invoiced = n(v, "confirmedKg");
    const ready = n(v, "readyForChiangMaiKg");
    const reserved = n(v, "reservedForOwnerKg");
    rows = [
      ["น้ำหนักตาม Invoice", `${fmt(invoiced)} กก.`],
      ["พร้อมส่ง Chef_house · เชียงใหม่", `${fmt(ready)} กก.`],
      ["เนื้อส่วนที่เหลือรอ Owner รับ (Waste)", `${fmt(reserved)} กก.`],
      ["รวมที่แบ่งแล้ว", `${fmt(ready + reserved)} / ${fmt(invoiced)} กก.`],
    ];
  }
  if (kind === "dispatch" && lot)
    rows = [
      [
        "PO ค้างส่ง",
        `${fmt(n(lot.values, "orderedKg") - db.lots.filter((l) => l.poId === lot.poId).reduce((s, l) => s + n(l.values, "dispatchKg"), 0))} กก.`,
      ],
      [
        "ค่ารถจากการตั้งค่า",
        `฿${fmt(n(lot.config, v.trip === "ไปกลับ" ? "roundFee" : "outboundFee"))}`,
      ],
    ];
  if (kind === "smokeOrder") {
    const rate = smokeServiceRate(n(v, "rawKg"));
    rows = [
      ["อัตราค่ารมอัตโนมัติ", `฿${fmt(rate)} / กก.`],
      ["ค่ารมควันประมาณการ", `฿${fmt(n(v, "rawKg") * rate)}`],
      ["เกณฑ์ราคา", "ต่ำกว่า 1,000 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180"],
    ];
  }
  if (kind === "smokingInvoice") {
    const rate = smokeServiceRate(n(v, "serviceQuantity"));
    rows = [
      ["อัตราค่ารมอัตโนมัติ", `฿${fmt(rate)} / กก.`],
      ["ยอดก่อน VAT อัตโนมัติ", `฿${fmt(n(v, "serviceQuantity") * rate)}`],
    ];
  }
  if (kind === "cmReceive" && lot)
    rows = [
      ["การตรวจรับ", "กรอกน้ำหนักจากตาชั่งของ Chef_house"],
      ["การตรวจสอบ", "Owner จะเปรียบเทียบน้ำหนักกับ Foodiva ภายหลัง"],
    ];
  if (kind === "prepare" && lot)
    rows = [["รับจริง", `${fmt(n(lot.values, "receivedKg"))} กก.`]];
  if (kind === "smoke" && lot) {
    const weights = (v.packs || "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    rows = [
      ["ถุงใหญ่จาก Chef_house", `${weights.length} ถุง`],
      [
        "น้ำหนักเนื้อหลังรมควัน",
        `${fmt(weights.reduce((s, w) => s + (Number.isFinite(w) ? w : 0), 0))} กก.`,
      ],
      ["น้ำหนัก Waste", `${fmt(n(v, "wasteKg"))} กก.`],
      [
        "รอผลิตก่อนรอบนี้",
        `${fmt(n(lot.values, "preKg") - processed(db, lot.id))} กก.`,
      ],
    ];
  }
  if (kind === "closeLot" && lot)
    rows = [
      ["น้ำหนักเนื้อหลังรมควัน", `${fmt(produced(db, lot.id))} กก.`],
      ["จำนวนถุงส่งกลับกรุงเทพฯ", `${producedBags(db, lot.id)} ถุง`],
      [
        "น้ำหนักรอผลิต",
        `${fmt(n(lot.values, "preKg") - processed(db, lot.id))} กก.`,
      ],
    ];
  if (kind === "return" && lot)
    rows = [
      ["ของที่ส่งกลับ Foodiva", `${producedBags(db, lot.id)} ถุง · ${fmt(produced(db, lot.id))} กก.`],
      [
        "ค่ารถขากลับ",
        `฿${fmt(lot.values.trip === "ไปกลับ" ? 0 : n(lot.config, "returnFee"))}`,
      ],
      ["รูปแบบขาไป", lot.values.trip],
    ];
  if (kind === "central" && lot)
    rows = [
      ["Foodiva รับเข้าตู้แล้ว", `${fmt(n(entries(db, "foodDivaReturnReceive", lot.id).at(-1)?.values || {}, "receivedKg"))} กก.`],
      ["จำนวนถุงที่ควรได้รับ", `${producedBags(db, lot.id)} ถุง`],
      ["ส่วนต่าง", `${fmt(n(v, "centralKg") - produced(db, lot.id))} กก.`],
    ];
  if (kind === "sale" && lot) {
    const expected = (n(v, "boxes") + n(v, "addons")) * n(db.config, "packKg");
    rows = [
      [
        "ยอดตามเมนู",
        `฿${fmt(n(v, "boxes") * n(db.config, "boxPrice") + n(v, "addons") * n(db.config, "addonPrice") + n(v, "chiliAddons") * n(db.config, "chiliPrice"))}`,
      ],
      ["น้ำหนักตามจำนวนขาย", `${fmt(expected)} กก.`],
      [
        "พร้อมขายหลังรายการนี้",
        `${fmt(balance(db, lot.id, db.config.branch).ready - n(v, "soldKg") - n(v, "wasteKg"))} กก.`,
      ],
      [
        "ข้าวที่จะหัก",
        `${fmt(n(v, "boxes") * 0.2 + n(v, "riceWasteKg"))} กก.`,
      ],
      ["น้ำพริกก่อนขาย", `${fmt(chiliStock(db, db.config.branch))} หลอดที่ Owner จัดสรร`],
      ["น้ำพริกที่จะหัก", `${n(v, "chiliAddons")} หลอดที่ลูกค้าซื้อ`],
      ["น้ำพริกควรเหลือ", `${fmt(chiliStock(db, db.config.branch) - n(v, "chiliAddons"))} หลอด`],
    ];
  }
  return rows.length ? (
    <div className="preview">
      <h3>ตรวจสอบก่อนบันทึก</h3>
      {rows.map(([k, value]) => (
        <Read key={k} label={k} value={value} />
      ))}
    </div>
  ) : null;
}
