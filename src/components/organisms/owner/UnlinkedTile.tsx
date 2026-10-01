"use client";

import { Link2 } from "lucide-react";
import { Panel } from "@/components/atoms/Panel";
import { Stat } from "@/components/atoms/Stat";
import { unlinkedSummary, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

/** DASH-01: what was recorded without its source and still waits to be tied to it. Every
 *  figure is read from the log (`unlinkedSummary`); linking or invoicing clears it by itself. */
export function UnlinkedTile({ db }: { db: Database }) {
  const summary = unlinkedSummary(db);
  const poIds = (ids: string[]) =>
    ids
      .map((id) => db.lots.find((lot) => lot.id === id)?.poId || id)
      .join(", ");
  const meat = Object.entries(summary.meatKg);
  const meatKg = meat.reduce((total, [, kg]) => total + kg, 0);
  const items = [
    {
      label: "เนื้อสาขา · ไม่ระบุ Lot (คงเหลือ)",
      value: `${fmt(meatKg)} กก.`,
      detail: summary.meatReceives
        ? `${meat.map(([branch, kg]) => `${branch} ${fmt(kg)} กก.`).join(" · ")} · รอผูก ${summary.meatReceives} รายการรับ`
        : "ทุกสาขาผูก Lot ครบ",
    },
    {
      label: "ชุดรมควัน · ไม่มี PO รมควัน",
      value: `${summary.batchesWithoutSmokeOrder.length} ชุด`,
      detail: poIds(summary.batchesWithoutSmokeOrder) || "ออก PO ครบทุกชุด",
    },
    {
      label: "PO ซื้อ · ไม่มี Invoice",
      value: `${summary.posWithoutInvoice.length} ใบ`,
      detail: poIds(summary.posWithoutInvoice) || "Foodiva ออก Invoice ครบ",
    },
  ];
  const open =
    summary.meatReceives > 0 ||
    summary.batchesWithoutSmokeOrder.length > 0 ||
    summary.posWithoutInvoice.length > 0;
  return (
    <Panel as="section" className="shadow-xs" aria-labelledby="unlinked-title">
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 size={18} aria-hidden />
          <h2 id="unlinked-title" className="m-0 text-text-primary">
            ยังไม่ผูก
          </h2>
        </div>
        <span className="text-caption text-text-secondary">
          {open
            ? "บันทึกแล้วแต่ยังไม่ผูกกับต้นทาง · ผูกได้จากประวัติรายการ"
            : "ทุกรายการผูกกับต้นทางแล้ว"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {items.map((item) => (
          <div key={item.label} className="grid content-start gap-1">
            <Stat label={item.label} value={item.value} />
            <small className="px-1 text-caption text-text-secondary">
              {item.detail}
            </small>
          </div>
        ))}
      </div>
    </Panel>
  );
}
