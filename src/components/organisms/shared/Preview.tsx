"use client";

import { ReferenceCard } from "@/components/molecules/ReferenceCard";
import {
  balance,
  chiliStock,
  entries,
  n,
  processed,
  produced,
  producedBags,
  smokeServiceRate,
  validPackWeights,
  type Database,
  type Lot,
  type Values,
} from "@/lib/store";
import { fmt } from "@/lib/format";

export function Preview({
  db,
  branch,
  lot,
  kind,
  v,
}: {
  db: Database;
  branch: string;
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
  if (kind === "foodivaConfirm") {
    const invoiced = n(v, "confirmedKg");
    const ready = n(v, "readyForChiangMaiKg");
    const reserved = n(v, "reservedForOwnerKg");
    rows = [
      ["น้ำหนักตาม Invoice", `${fmt(invoiced)} กก.`],
      ["พร้อมส่ง Chef House · เชียงใหม่", `${fmt(ready)} กก.`],
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
        `฿${fmt(n(db.config, v.trip === "ไปกลับ" ? "roundFee" : "outboundFee"))}`,
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
    // mutate bills the smoke PO's raw kg, so show that even if the form value is missing.
    const quantity =
      (lot &&
        n(entries(db, "smokeOrder", lot.id).at(-1)?.values || {}, "rawKg")) ||
      n(v, "serviceQuantity");
    const rate = smokeServiceRate(quantity);
    rows = [
      ["น้ำหนักตาม PO รมควัน", `${fmt(quantity)} กก.`],
      ["อัตราค่ารมอัตโนมัติ", `฿${fmt(rate)} / กก.`],
      ["ยอดก่อน VAT อัตโนมัติ", `฿${fmt(quantity * rate)}`],
    ];
  }
  if (kind === "cmReceive" && lot)
    rows = [
      ["การตรวจรับ", "กรอกน้ำหนักจากตาชั่งของ Chef House"],
      ["การตรวจสอบ", "Owner จะเปรียบเทียบน้ำหนักกับ Foodiva ภายหลัง"],
    ];
  if (kind === "prepare" && lot)
    rows = [["รับจริง", `${fmt(n(lot.values, "receivedKg"))} กก.`]];
  if (kind === "smoke" && lot) {
    const weights = validPackWeights(v.packs);
    rows = [
      ["กล่องรมควัน", `${weights.length} กล่องรมควัน`],
      [
        "น้ำหนักเนื้อหลังรมควัน",
        `${fmt(weights.reduce((s, w) => s + w, 0))} กก.`,
      ],
      ["น้ำหนัก Waste", `${fmt(n(v, "wasteKg"))} กก.`],
      [
        "รอผลิตก่อนรอบนี้",
        `${fmt(n(lot.values, "preSmokeKg") - processed(db, lot.id))} กก.`,
      ],
    ];
  }
  if (kind === "closeLot" && lot)
    rows = [
      [
        "ผลผลิตรอบนี้",
        `รวม ${producedBags(db, lot.id)} กล่องรมควัน · ${fmt(produced(db, lot.id))} กก.`,
      ],
      [
        "น้ำหนักรอผลิต",
        `${fmt(n(lot.values, "preSmokeKg") - processed(db, lot.id))} กก.`,
      ],
    ];
  if (kind === "return" && lot)
    rows = [
      [
        "ของที่ส่งกลับ Foodiva",
        `${producedBags(db, lot.id)} กล่องรมควัน · ${fmt(produced(db, lot.id))} กก.`,
      ],
      [
        "ค่ารถขากลับ",
        `฿${fmt(lot.values.trip === "ไปกลับ" ? 0 : n(db.config, "returnFee"))}`,
      ],
      ["รูปแบบขาไป", lot.values.trip],
    ];
  if (kind === "central" && lot)
    rows = [
      [
        "Foodiva รับเข้าตู้แล้ว",
        `${fmt(n(entries(db, "foodivaReturnReceive", lot.id).at(-1)?.values || {}, "receivedKg"))} กก.`,
      ],
      [
        "จำนวนกล่องรมควันที่ควรได้รับ",
        `${producedBags(db, lot.id)} กล่องรมควัน`,
      ],
      [
        "ส่วนต่าง (ก่อน−หลัง สโมค)",
        `${fmt(Math.abs(n(lot.values, "preSmokeKg") - produced(db, lot.id)))} กก.`,
      ],
    ];
  if ((kind === "sale" || kind === "influencerBox") && lot) {
    const expected = (n(v, "boxes") + n(v, "addons")) * n(db.config, "packKg");
    rows = [
      [
        kind === "sale" ? "ยอดตามเมนู" : "มูลค่าของที่แจก (ตามเมนู)",
        `฿${fmt(n(v, "boxes") * n(db.config, "boxPrice") + n(v, "addons") * n(db.config, "addonPrice") + n(v, "chiliAddons") * n(db.config, "chiliPrice"))}`,
      ],
      [
        kind === "sale" ? "น้ำหนักตามจำนวนขาย" : "น้ำหนักตามจำนวนที่ส่ง",
        `${fmt(expected)} กก.`,
      ],
      [
        "พร้อมขายหลังรายการนี้",
        `${fmt(balance(db, lot.id, branch).ready - n(v, "soldKg") - n(v, "wasteKg"))} กก.`,
      ],
      ["ข้าวที่จะหัก", `${fmt(n(v, "boxes") * 0.2 + n(v, "riceWasteKg"))} กก.`],
      [
        kind === "sale" ? "น้ำพริกก่อนขาย" : "น้ำพริกก่อนตัดสต๊อก",
        `${fmt(chiliStock(db, branch))} หลอดที่ Owner จัดสรร`,
      ],
      [
        "น้ำพริกที่จะหัก",
        `${n(v, "chiliAddons")} หลอด${kind === "sale" ? "ที่ลูกค้าซื้อ" : "ที่ส่งไปด้วย"}`,
      ],
      [
        "น้ำพริกควรเหลือ",
        `${fmt(chiliStock(db, branch) - n(v, "chiliAddons"))} หลอด`,
      ],
    ];
  }
  return rows.length ? (
    <ReferenceCard title="ตรวจสอบก่อนบันทึก" rows={rows} className="my-0" />
  ) : null;
}
