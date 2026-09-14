"use client";

import { DataTable } from "@/components/organisms/shared/DataTable";
import { entries, n, produced, producedBags, smokingInvoiceStatus, stages, titles, type Database, type Lot } from "@/lib/store";
import { fmt } from "@/lib/format";

export function ChefLotTable({
  db,
  lots,
  open,
}: {
  db: Database;
  lots: Lot[];
  open: (kind: string, lotId?: string) => void;
}) {
  const smokeLogs = lots.flatMap((lot) =>
    entries(db, "smoke", lot.id).map((entry) => {
      const batchesBeforeOrAtThisEntry = entries(db, "smoke", lot.id).slice(
        0,
        entries(db, "smoke", lot.id).findIndex((batch) => batch.id === entry.id) + 1,
      );
      const weights = (entry.values.packs || "")
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
        .filter((weight) => Number.isFinite(weight) && weight > 0);
      const weightGroups = Array.from(
        weights.reduce((groups, weight) => {
          const key = fmt(weight);
          groups.set(key, (groups.get(key) || 0) + 1);
          return groups;
        }, new Map<string, number>()),
      );
      const bagDetail = weightGroups.length
        ? weightGroups.map(([weight, count]) => `${weight} × ${count}`).join(" + ")
        : "—";
      return {
        lot,
        entry,
        weights,
        bagDetail,
        remainingKg: Math.max(
          0,
          n(lot.values, "preKg") -
            batchesBeforeOrAtThisEntry.reduce(
              (total, batch) => total + n(batch.values, "inputKg"),
              0,
            ),
        ),
      };
    }),
  );
  const action = (lot: Lot) => {
    const smokeOrder = entries(db, "smokeOrder", lot.id).at(-1);
    const accepted = entries(db, "smokeOrderAccept", lot.id).at(-1);
    const latestInvoice = entries(db, "smokingInvoice", lot.id).at(-1);
    const invoiceStatus = latestInvoice ? smokingInvoiceStatus(db, latestInvoice) : "";
    if (!smokeOrder) return "รอ Owner ออก PO รมควัน";
    if (!accepted) return <button className="table-action" onClick={() => open("smokeOrderAccept", lot.id)}>ยืนยันรับ PO รมควัน</button>;
    if (!latestInvoice || invoiceStatus === "ส่งกลับแก้ไข") return <button className="table-action" onClick={() => open("smokingInvoice", lot.id)}>{latestInvoice ? "แก้ไขและ Submit ใบวางบิล" : "สร้าง / Submit ใบวางบิล"}</button>;
    if (lot.stage < 2) return <span className="badge">{invoiceStatus} · รอ Owner เรียกรถ</span>;
    const kind = lot.stage === 3 ? "prepare" : lot.stage === 4 ? "smoke" : lot.stage === 5 ? "closeLot" : "";
    if (lot.stage === 5)
      return (
        <div className="button-row compact-actions">
          <button className="secondary table-action" onClick={() => open("chefEdit", lot.id)}>
            Edit ข้อมูลก่อนปิด Lot
          </button>
          <button className="table-action" onClick={() => open("closeLot", lot.id)}>
            ยืนยันปิด Lot
          </button>
        </div>
      );
    if (lot.stage >= 6) return <span className="badge">{invoiceStatus}</span>;
    return kind ? (
      <button className="table-action" onClick={() => open(kind, lot.id)}>{titles[kind]}</button>
    ) : lot.stage === 2 ? "ไปเมนูยืนยันรับเนื้อ" : "ส่งต่องานแล้ว";
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Lot งานผลิต Chef_house</h2>
          <p className="muted">ดูสถานะและทำงานต่อจากตาราง โดยไม่ต้องเปิดทีละการ์ด</p>
        </div>
      </div>
      <DataTable
        title="รายการ Lot ทั้งหมด"
        columns={["Lot", "PO รมควัน", "เอกสาร PO", "รับจริง", "สถานะ", "น้ำหนักหลังรมควัน", "จำนวนถุง", "การทำงาน"]}
        rows={lots.map((lot) => [
          lot.id,
          entries(db, "smokeOrder", lot.id).at(-1)?.values.orderNumber || "รอ Owner ออก PO",
          entries(db, "smokeOrder", lot.id).length ? (
            <button key={`${lot.id}-po`} type="button" className="table-action" onClick={() => open("smokeOrderPreview", lot.id)}>
              ดู PO รมควัน
            </button>
          ) : "—",
          n(lot.values, "receivedKg") ? `${fmt(n(lot.values, "receivedKg"))} กก.` : "รอยืนยันรับ",
          stages[lot.stage],
          produced(db, lot.id) ? `${fmt(produced(db, lot.id))} กก.` : "-",
          producedBags(db, lot.id) ? `${producedBags(db, lot.id)} ถุง` : "-",
          action(lot),
        ])}
      />
      <DataTable
        title={`Log Lot สโมครายวัน ${smokeLogs.length} รอบ`}
        columns={["วันที่สโมค", "Lot หลัก", "Lot สโมค", "น้ำหนักเข้าเตา", "ถุงที่ได้", "น้ำหนักหลังรม", "น้ำหนัก Waste", "คงเหลือรอผลิต"]}
        rows={smokeLogs.map(({ lot, entry, weights, bagDetail, remainingKg }) => [
          entry.values.smokeDate || entry.date,
          lot.id,
          entry.values.subLot || "—",
          `${fmt(n(entry.values, "inputKg"))} กก.`,
          weights.length ? `${weights.length} ถุง · ${bagDetail} กก.` : "—",
          `${fmt(n(entry.values, "outputKg"))} กก.`,
          `${fmt(n(entry.values, "wasteKg"))} กก.`,
          `${fmt(remainingKg)} กก.`,
        ])}
      />
    </>
  );
}
