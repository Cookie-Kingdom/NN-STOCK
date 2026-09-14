"use client";

import { Badge } from "@/components/atoms/Badge";
import { Panel } from "@/components/atoms/Panel";
import { ReadRow } from "@/components/atoms/ReadRow";
import { Stat } from "@/components/atoms/Stat";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { balance, lotCost, n, processed, produced, stages, type Database, type Lot, type Role } from "@/lib/store";
import { fmt } from "@/lib/format";

export function LotDetails({ db, lot, role }: { db: Database; lot: Lot; role: Role }) {
  const output = produced(db, lot.id),
    c = lotCost(db, lot),
    dispatched = n(lot.values, "dispatchKg");
  return (
    <Panel>
      <SectionHeading title={lot.id} actions={<Badge>{stages[lot.stage]}</Badge>} />
      <div className="mt-4 mb-5">
        <div className="flex items-center justify-between gap-3.5 text-caption text-text-secondary">
          <span>
            ขั้นตอน {lot.stage + 1} จาก {stages.length}
          </span>
          <strong className="text-body-sm font-semibold text-text-primary">{stages[lot.stage]}</strong>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border">
          <i
            className="block h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${((lot.stage + 1) / stages.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="my-4.5 grid grid-cols-[repeat(auto-fit,minmax(145px,1fr))] gap-3 max-md:grid-cols-2">
        {role === "branch" ? (
          <>
            <Stat
              label="รับเข้าสาขา"
              value={`${fmt(balance(db, lot.id, db.config.branch).received)} กก.`}
            />
            <Stat
              label="พร้อมขาย"
              value={`${fmt(balance(db, lot.id, db.config.branch).ready)} กก.`}
            />
          </>
        ) : (
          <>
            <Stat label="ส่งจากผู้ขาย" value={`${fmt(dispatched)} กก.`} />
            <Stat label="น้ำหนักเนื้อหลังรมควัน" value={`${fmt(output)} กก.`} />
            <Stat
              label="รอผลิต"
              value={`${fmt(n(lot.values, "preKg") - processed(db, lot.id))} กก.`}
            />
          </>
        )}
      </div>
      {role === "owner" && (
        <>
          <ReadRow
            label="ผู้ขาย / PO"
            value={`${lot.values.supplier} · ${lot.poId}`}
          />
          <ReadRow label="ต้นทุน Lot ตามข้อมูลขณะนี้" value={`฿${fmt(c.total)}`} />
          <ReadRow
            label="ต้นทุน / กก. รับกลาง"
            value={c.perKg === null ? "รอรับสต๊อกกลาง" : `฿${fmt(c.perKg)}`}
          />
          <ReadRow
            label="Loss จากน้ำหนัก Foodiva"
            value={
              lot.stage >= 6 && dispatched > 0
                ? `${fmt(((dispatched - output) / dispatched) * 100)}%`
                : "รอปิด Lot"
            }
          />
          {lot.stage >= 6 &&
            dispatched > 0 &&
            (dispatched - output) / dispatched > 0.2 && (
              <Notice tone="warning">
                Loss เกิน 20% · ตรวจสอบได้โดยไม่หยุดการส่งต่องาน
              </Notice>
            )}
        </>
      )}
    </Panel>
  );
}
