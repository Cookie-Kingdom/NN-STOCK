"use client";

import type { ReactNode } from "react";
import { ReferenceCard } from "@/components/molecules/ReferenceCard";
import {
  balance,
  chiliStock,
  cookedRiceStock,
  entries,
  lotCost,
  n,
  processed,
  produced,
  producedBags,
  rawRiceStock,
  smokeServiceRate,
  validPackWeights,
  type Database,
  type Lot,
  type Values,
} from "@/lib/store";
import { fmt } from "@/lib/format";

/** A withdrawal: what leaves, the stock now and the stock after it. A stock that would
 *  go negative is shown red; the form's live error is what blocks the save. */
function issueRows(
  item: string,
  stock: number,
  issued: number,
  unit: (x: number) => string,
): [string, ReactNode][] {
  const after = stock - issued;
  return [
    [`${item}ที่เบิก`, unit(issued)],
    [`${item}คงเหลือตอนนี้`, unit(stock)],
    [
      `${item}คงเหลือหลังรายการนี้`,
      after < -0.001 ? (
        <span className="text-danger">{unit(after)}</span>
      ) : (
        unit(after)
      ),
    ],
  ];
}

export function Preview({
  db,
  branch,
  lot,
  kind,
  v,
  giveaways = [],
}: {
  db: Database;
  branch: string;
  lot?: Lot;
  kind: string;
  v: Values;
  /** Influencer blocks entered on the sale form, saved with the sale. */
  giveaways?: Values[];
}) {
  let rows: [string, ReactNode][] = [];
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
      ["ยอดตามอัตรา (ตั้งต้น)", `฿${fmt(quantity * rate)}`],
      ["ยอดเรียกเก็บ", `฿${fmt(n(v, "netPayable"))}`],
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
        // Follows the weight typed in the form; the lot's output until one is entered.
        `${producedBags(db, lot.id)} กล่องรมควัน · ${fmt(v.returnKg?.trim() ? n(v, "returnKg") : produced(db, lot.id))} กก.`,
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
    /* Giveaways saved with this sale leave the same shelf, so they count in every
     * "after" row. Their meat is costed like mutate does: boxes × packKg × lot ฿/kg. */
    const perKg = lotCost(db, lot).perKg || 0;
    const sum = (key: string) => giveaways.reduce((s, g) => s + n(g, key), 0);
    const giftKg = sum("boxes") * n(db.config, "packKg");
    const giftCost = giftKg * perKg + sum("shippingFee");
    const saleCost =
      (n(v, "soldKg") + n(v, "wasteKg")) * perKg + n(v, "expense");
    rows = [
      [
        kind === "sale" ? "ยอดตามเมนู" : "มูลค่าของที่แจก (ตามเมนู)",
        `฿${fmt(n(v, "boxes") * n(db.config, "boxPrice") + n(v, "addons") * n(db.config, "addonPrice") + n(v, "chiliAddons") * n(db.config, "chiliPrice"))}`,
      ],
      [
        kind === "sale" ? "น้ำหนักตามจำนวนขาย" : "น้ำหนักตามจำนวนที่ส่ง",
        `${fmt(expected)} กก.`,
      ],
      /* The pair: what the pack count says, and what the branch actually weighed.
       * Only for sale — a giveaway's kg is derived from the box count, so the two
       * rows would print the same number and read as something the user typed. */
      ...(kind === "sale"
        ? ([
            ["น้ำหนักเนื้อที่ใช้ไปจริงวันนี้", `${fmt(n(v, "soldKg"))} กก.`],
          ] as [string, ReactNode][])
        : []),
      [
        "คงเหลือชิลหลังรายการนี้",
        `${fmt(balance(db, lot.id, branch).ready - n(v, "soldKg") - n(v, "wasteKg") - giftKg)} กก.`,
      ],
      [
        "ข้าวที่จะหัก",
        `${fmt((n(v, "boxes") + sum("boxes")) * 0.2 + n(v, "riceWasteKg"))} กก.`,
      ],
      [
        kind === "sale" ? "น้ำพริกก่อนขาย" : "น้ำพริกก่อนตัดสต๊อก",
        `${fmt(chiliStock(db, branch))} หลอดที่ Owner จัดสรร`,
      ],
      [
        "น้ำพริกที่จะหัก",
        `${n(v, "chiliAddons")} หลอด${kind === "sale" ? "ที่ลูกค้าซื้อ" : "ที่ส่งไปด้วย"}${sum("chiliAddons") ? ` + ${sum("chiliAddons")} หลอดที่แจกอินฟลูเอนเซอร์` : ""}`,
      ],
      [
        "น้ำพริกควรเหลือ",
        `${fmt(chiliStock(db, branch) - n(v, "chiliAddons") - sum("chiliAddons"))} หลอด`,
      ],
      /* Same split as the owner report: a giveaway is marketing cost, never revenue.
       * A branch account's copy has no purchase prices (role-scope.ts), so it cannot cost
       * the meat: the rows are left out rather than shown as ฿0 meat. */
      ...(kind === "sale" && perKg > 0
        ? ([
            ["ต้นทุนเนื้อที่ขาย + Waste + ค่าใช้จ่ายสาขา", `฿${fmt(saleCost)}`],
            ...(giveaways.length
              ? [
                  [
                    `ต้นทุนของแจกอินฟลูเอนเซอร์ ${giveaways.length} ราย (เนื้อ + ค่าส่ง · ไม่นับเป็นรายรับ)`,
                    `฿${fmt(giftCost)}`,
                  ],
                ]
              : []),
            ["รวมต้นทุนรายการนี้", `฿${fmt(saleCost + giftCost)}`],
          ] as [string, ReactNode][])
        : []),
    ];
  }
  if (kind === "riceCarry") {
    const discard = v.reheat === "ไม่นำกลับมาใช้";
    const stock = cookedRiceStock(db, branch);
    rows = [
      ["ข้าวเหนียวสุกในระบบ", `${fmt(stock)} กก.`],
      [
        "Waste ข้าวเหนียวสุก (ไม่นำกลับมาใช้)",
        `${fmt(discard ? n(v, "leftoverKg") : 0)} กก.`,
      ],
      [
        "ข้าวเหนียวสุกยกไปวันถัดไป",
        `${fmt(discard ? stock - n(v, "leftoverKg") : stock)} กก.`,
      ],
    ];
  }
  if (kind === "riceIssue" || kind === "chiliIssue" || kind === "supplyIssue") {
    // มีนบุรี buys cooked rice, so its combined form has no raw rice to issue.
    const rice =
      kind === "riceIssue" || (kind === "supplyIssue" && branch !== "มีนบุรี");
    const chili = kind !== "riceIssue";
    rows = [
      ...(rice
        ? issueRows(
            "ข้าวเหนียวดิบ",
            rawRiceStock(db, branch),
            n(v, "rawRiceIssuedKg"),
            (x) => `${fmt(x)} กก.`,
          )
        : []),
      ...(chili
        ? issueRows(
            "น้ำพริก",
            chiliStock(db, branch),
            n(v, "chiliIssuedTubes"),
            (x) => `${x} หลอด`,
          )
        : []),
      ["ผู้รับของ", v.receiver?.trim() || "—"],
    ];
  }
  return rows.length ? (
    <ReferenceCard title="ตรวจสอบก่อนบันทึก" rows={rows} className="my-0" />
  ) : null;
}
