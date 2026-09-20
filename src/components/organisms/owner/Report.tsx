"use client";

import { useState } from "react";
import { Panel } from "@/components/atoms/Panel";
import { Muted } from "@/components/atoms/Text";
import { BranchSelectFilter } from "@/components/molecules/BranchSelectFilter";
import { DateRangeFilter } from "@/components/molecules/DateRangeFilter";
import { FilterBar } from "@/components/molecules/FilterBar";
import { Notice } from "@/components/molecules/Notice";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  branches,
  entries,
  isClosed,
  lotCost,
  materialPar,
  materialUnitPrice,
  materials,
  n,
  stages,
  type Database,
  type Entry,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";

const OWNER_WIDE_KINDS = ["expense", "materialReceive", "generalPurchase"];

export function Report({ db }: { db: Database }) {
  const allDates = db.entries
    .map((e) => e.date)
    .filter(Boolean)
    .sort();
  const [fromDate, setFromDate] = useState(allDates[0] || today());
  const [toDate, setToDate] = useState(allDates.at(-1) || today());
  const [branchFilter, setBranchFilter] = useState("ทั้งหมด");
  const allBranches = branchFilter === "ทั้งหมด";
  /* Owner-wide costs are not bound to a branch (their `branch` is just config.branch),
   * so they only count in the all-branches view; per-branch reports then add up to it. */
  const inRange = (entry: Entry) =>
    entry.date >= fromDate &&
    entry.date <= toDate &&
    (allBranches ||
      (!OWNER_WIDE_KINDS.includes(entry.kind) &&
        entry.branch === branchFilter));
  const sales = entries(db, "sale").filter(inRange),
    supplyPurchases = [
      ...entries(db, "supplyPurchase"),
      ...entries(db, "ricePurchase"),
      ...entries(db, "chiliPurchase"),
    ]
      .filter(inRange)
      .sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at)),
    supplyCost = supplyPurchases.reduce(
      (sum, entry) => sum + n(entry.values, "totalCost"),
      0,
    ),
    ownerExpenseCost = entries(db, "expense")
      .filter(inRange)
      .reduce((sum, entry) => sum + n(entry.values, "amount"), 0),
    materialPurchaseCost = entries(db, "materialReceive")
      .filter(inRange)
      .reduce((sum, entry) => sum + n(entry.values, "totalCost"), 0),
    generalPurchaseCost = entries(db, "generalPurchase")
      .filter(inRange)
      .reduce((sum, entry) => sum + n(entry.values, "totalCost"), 0),
    influencerBoxes = entries(db, "influencerBox").filter(inRange),
    influencerCost = influencerBoxes.reduce(
      (sum, entry) =>
        sum + n(entry.values, "meatCost") + n(entry.values, "shippingFee"),
      0,
    ),
    cost =
      influencerCost +
      supplyCost +
      ownerExpenseCost +
      materialPurchaseCost +
      generalPurchaseCost +
      sales.reduce(
        (s, e) =>
          s +
          n(e.values, "meatCost") +
          n(e.values, "wasteCost") +
          n(e.values, "expense"),
        0,
      );
  const margin =
    sales.reduce((sum, e) => sum + n(e.values, "revenue"), 0) - cost;
  const dayRows = Array.from(new Set(sales.map((e) => `${e.date}|${e.branch}`)))
    // Oldest first, the order DataTable's sort expects; the table flips it.
    .sort()
    .map((key) => {
      const [date, branch] = key.split("|"),
        rows = entries(db, "sale", undefined, branch, date).filter(inRange);
      const rev = rows.reduce((s, e) => s + n(e.values, "revenue"), 0),
        boxes = rows.reduce((s, e) => s + n(e.values, "boxes"), 0),
        addons = rows.reduce((s, e) => s + n(e.values, "addons"), 0),
        chiliAddons = rows.reduce((s, e) => s + n(e.values, "chiliAddons"), 0),
        waste = rows.reduce((s, e) => s + n(e.values, "wasteKg"), 0);
      return [
        date,
        branch,
        String(boxes),
        String(addons),
        String(chiliAddons),
        fmt(waste),
        fmt(rev),
        isClosed(db, branch, date) ? "ปิดแล้ว" : "เปิดอยู่",
      ];
    });
  return (
    <div className="grid gap-7.5">
      <Panel className="flex items-end justify-between gap-5 max-md:flex-col max-md:items-stretch">
        <div>
          <h2 className="m-0">ตัวกรองรายงาน (Report filters)</h2>
          <Muted className="m-0">
            เลือกช่วงวันที่และสาขา ทุกตารางด้านล่างจะเปลี่ยนพร้อมกัน
          </Muted>
        </div>
        <FilterBar>
          <DateRangeFilter
            from={fromDate}
            to={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
          />
          <BranchSelectFilter
            value={branchFilter}
            onChange={setBranchFilter}
            branches={branches}
          />
        </FilterBar>
      </Panel>
      <DataTable
        className="m-0"
        title="สรุปผลรวม"
        columns={["รายการ", "จำนวนเงิน", "ขอบเขต"]}
        rows={[
          [
            "ยอดขาย LINE MAN",
            fmt(sales.reduce((sum, e) => sum + n(e.values, "revenue"), 0)),
            "บาท",
          ],
          ["ต้นทุนรวมทั้งหมด (เนื้อ + Waste + ค่าใช้จ่ายสาขา + รายการย่อยด้านล่าง)", fmt(cost), "บาท"],
          [
            "↳ กล่องโปรโมทอินฟลูเอนเซอร์ (เนื้อ + ค่าส่ง)",
            fmt(influencerCost),
            "บาท",
          ],
          ["↳ ค่าใช้จ่าย Owner", fmt(ownerExpenseCost), "บาท"],
          ["↳ ซื้อวัสดุบรรจุภัณฑ์", fmt(materialPurchaseCost), "บาท"],
          ["↳ ซื้อวัตถุดิบ / ETC (รวมอยู่ในต้นทุนรวมแล้ว)", fmt(generalPurchaseCost), "บาท"],
          [
            "ส่วนต่างหลังต้นทุนที่บันทึก",
            fmt(margin),
            "บาท",
          ],
        ]}
      />
      <Notice>
        {allBranches
          ? "ตัวเลขนี้รวมค่าใช้จ่าย Owner การซื้อวัสดุ วัตถุดิบ และ ETC ที่บันทึกแล้ว แต่ยังไม่รวม"
          : `ตัวเลขของสาขา${branchFilter}ไม่รวมค่าใช้จ่าย Owner การซื้อวัสดุ วัตถุดิบ และ ETC ซึ่งเป็นรายการรวมทุกสาขา (ดูได้เมื่อเลือกสาขา "ทั้งหมด") และยังไม่รวม`}{" "}
        ภาษี แรงงาน ค่าเสื่อม และรายการที่ยังไม่ได้กรอก จึงยังไม่ใช่กำไรสุทธิ
      </Notice>
      <DataTable
        className="m-0"
        title="รายงานยอดขายรายวัน"
        columns={[
          "วันที่",
          "สาขา",
          "กล่อง",
          "เนื้อ Add-on",
          "น้ำพริกขายแยก",
          "Waste (กก.)",
          "LINE MAN (บาท)",
          "สถานะ",
        ]}
        rows={dayRows}
      />
      <DataTable
        className="m-0"
        title="ยอดขายสะสมแยกสาขา"
        columns={[
          "สาขา",
          "กล่อง",
          "เนื้อ Add-on",
          "น้ำพริกขายแยก",
          "Waste (กก.)",
          "ยอดขาย (บาท)",
        ]}
        rows={branches.map((br) => {
          const rows = entries(db, "sale", undefined, br).filter(inRange);
          return [
            br,
            String(rows.reduce((s, e) => s + n(e.values, "boxes"), 0)),
            String(rows.reduce((s, e) => s + n(e.values, "addons"), 0)),
            String(rows.reduce((s, e) => s + n(e.values, "chiliAddons"), 0)),
            fmt(rows.reduce((s, e) => s + n(e.values, "wasteKg"), 0)),
            fmt(rows.reduce((s, e) => s + n(e.values, "revenue"), 0)),
          ];
        })}
      />
      <DataTable
        className="m-0"
        title="กล่องโปรโมทอินฟลูเอนเซอร์ · ต้นทุนการตลาด ไม่ใช่ยอดขาย"
        columns={[
          "วันที่",
          "สาขา",
          "อินฟลูเอนเซอร์",
          "กล่อง",
          "เนื้อ (กก.)",
          "ค่าส่ง (บาท)",
          "ต้นทุนรวม (บาท)",
        ]}
        rows={influencerBoxes.map((e) => [
          e.date,
          e.branch,
          e.values.influencer,
          String(n(e.values, "boxes")),
          fmt(n(e.values, "soldKg")),
          fmt(n(e.values, "shippingFee")),
          fmt(n(e.values, "meatCost") + n(e.values, "shippingFee")),
        ])}
      />
      <DataTable
        className="m-0"
        title="ต้นทุนแยก Lot"
        columns={[
          "Lot",
          "สถานะ",
          "เนื้อ",
          "รมควัน (Smoking)",
          "รถ",
          "รวม",
          "ต้นทุน / กก.",
        ]}
        rows={db.lots
          .filter((l) => l.stage > 1)
          .map((l) => {
            const c = lotCost(db, l);
            return [
              l.id,
              stages[l.stage],
              fmt(c.meat),
              fmt(c.smoke),
              fmt(c.freight),
              fmt(c.total),
              c.perKg === null ? "รอรับกลาง" : fmt(c.perKg),
            ];
          })}
      />
      <DataTable
        className="m-0"
        title="ค่าใช้จ่าย Owner"
        columns={["วันที่", "หมวด", "รายละเอียด", "ผู้จ่าย", "จำนวนเงิน"]}
        rows={entries(db, "expense")
          .filter(inRange)
          .map((e) => [
            e.date,
            e.values.category,
            e.values.detail,
            e.values.payer,
            fmt(n(e.values, "amount")),
          ])}
      />
      <DataTable
        className="m-0"
        title="รายการซื้อข้าวเหนียวและน้ำพริก"
        columns={[
          "วันที่",
          "สาขา",
          "ผู้จำหน่าย",
          "ข้าวดิบ (กก.)",
          "ข้าวสุก (กก.)",
          "น้ำพริก (หลอด)",
          "ยอดซื้อรวม",
        ]}
        rows={supplyPurchases.map((entry) => [
          entry.date,
          entry.branch,
          entry.values.supplier,
          fmt(n(entry.values, "rawRiceKg")),
          fmt(n(entry.values, "cookedRiceKg")),
          fmt(n(entry.values, "chiliTubes")),
          fmt(n(entry.values, "totalCost")),
        ])}
      />
      <DataTable
        className="m-0"
        title="ข้าวเหนียวสุกคงเหลือปลายวัน"
        columns={[
          "วันที่",
          "สาขา",
          "คงเหลือ (กก.)",
          "การจัดการวันถัดไป",
          "เหตุผลส่วนต่าง",
        ]}
        rows={entries(db, "riceCarry")
          .filter(inRange)
          .map((entry) => [
            entry.date,
            entry.branch,
            fmt(n(entry.values, "leftoverKg")),
            entry.values.reheat,
            entry.values.reason || "—",
          ])}
      />
      <DataTable
        className="m-0"
        title="รายการเบิกข้าวเหนียวดิบรายวัน"
        columns={["วันที่", "สาขา", "ผู้รับ", "ข้าวเหนียวดิบ (กก.)"]}
        rows={[...entries(db, "supplyIssue"), ...entries(db, "riceIssue")]
          .filter(
            (entry) => inRange(entry) && n(entry.values, "rawRiceIssuedKg") > 0,
          )
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((entry) => [
            entry.date,
            entry.branch,
            entry.values.receiver,
            fmt(n(entry.values, "rawRiceIssuedKg")),
          ])}
      />
      <DataTable
        className="m-0"
        title="ประวัติจัดสรรน้ำพริกโดย Owner"
        columns={[
          "วันที่",
          "สาขา",
          "จัดสรร",
          "ผู้รับ",
          "เลขอ้างอิง",
          "หมายเหตุ",
        ]}
        rows={entries(db, "chiliAllocate")
          .filter(inRange)
          .sort(
            (a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at),
          )
          .map((entry) => [
            entry.date,
            entry.branch,
            `${fmt(n(entry.values, "chiliTubes"))} หลอด`,
            entry.values.receiver || "—",
            entry.values.reference || "—",
            entry.values.note || "—",
          ])}
      />
      <DataTable
        className="m-0"
        title="ประวัติรับและส่งวัสดุ (Material audit trail)"
        columns={[
          "วันที่",
          "รายการ",
          "วัสดุ",
          "ต้นทาง / ปลายทาง",
          "จำนวน",
          "ผู้เกี่ยวข้อง",
          "อ้างอิง / สถานะ",
        ]}
        rows={[
          ...entries(db, "materialReceive"),
          ...entries(db, "materialTransfer"),
          ...entries(db, "materialConfirm"),
        ]
          .filter(inRange)
          .sort(
            (a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at),
          )
          .map((entry) => {
            const transfer =
              entry.kind === "materialConfirm"
                ? db.entries.find((item) => item.id === entry.values.transferId)
                : undefined;
            return [
              entry.date,
              entry.kind === "materialReceive"
                ? "รับเข้าคลัง Owner"
                : entry.kind === "materialTransfer"
                  ? "ส่งไปสาขา"
                  : "สาขายืนยันรับ",
              entry.values.material || transfer?.values.material || "—",
              entry.kind === "materialReceive"
                ? `${entry.values.supplier || "—"} → คลัง Owner`
                : entry.kind === "materialTransfer"
                  ? `คลัง Owner → ${entry.branch || "—"}`
                  : entry.branch || "—",
              `${fmt(n(entry.values, "quantity") || n(entry.values, "receivedQuantity"))} ชิ้น`,
              entry.values.receiver || "Owner",
              entry.kind === "materialConfirm"
                ? entry.values.reason || "รับครบ"
                : entry.values.reference ||
                  (entry.values.requiresConfirm
                    ? "รอสาขายืนยัน"
                    : "ข้อมูลเดิม"),
            ];
          })}
      />
      <DataTable
        className="m-0"
        title="วัสดุคงเหลือล่าสุด"
        columns={[
          "สาขา",
          "วัสดุ",
          "ใช้ล่าสุด",
          "คงเหลือ",
          "ฐานเต็ม",
          "ราคา / หน่วย",
          "มูลค่าคงเหลือ",
          "สถานะ",
        ]}
        rows={branches.flatMap((br) => {
          const row = entries(db, "materials", undefined, br)
            .filter(inRange)
            .at(-1);
          return materials.map((m, i) => {
            const base = materialPar(db, br, i),
              price = materialUnitPrice(db, br, i),
              qty = row ? n(row.values, "material" + i) : 0;
            return [
              br,
              m,
              row?.values["used" + i] ?? "—",
              row ? String(qty) : "—",
              base ? String(base) : "—",
              price ? fmt(price) : "—",
              row && price ? fmt(qty * price) : "—",
              !row
                ? "ยังไม่ได้นับ"
                : base === 0
                  ? "ยังไม่ตั้งฐาน"
                  : qty < base * 0.2
                    ? "ต่ำกว่า 20%"
                    : "ปกติ",
            ];
          });
        })}
      />
    </div>
  );
}
