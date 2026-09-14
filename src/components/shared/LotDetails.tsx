"use client";

import { Read, Stat } from "@/components/shared/primitives";
import { balance, lotCost, n, processed, produced, stages, type Database, type Lot, type Role } from "@/lib/store";
import { fmt } from "@/lib/format";

export function LotDetails({ db, lot, role }: { db: Database; lot: Lot; role: Role }) {
  const output = produced(db, lot.id),
    c = lotCost(db, lot),
    dispatched = n(lot.values, "dispatchKg");
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{lot.id}</h2>
        <span className="badge">{stages[lot.stage]}</span>
      </div>
      <div className="progress-summary">
        <div>
          <span>
            ขั้นตอน {lot.stage + 1} จาก {stages.length}
          </span>
          <strong>{stages[lot.stage]}</strong>
        </div>
        <div className="progress-track">
          <i style={{ width: `${((lot.stage + 1) / stages.length) * 100}%` }} />
        </div>
      </div>
      <div className="stats-grid">
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
          <Read
            label="ผู้ขาย / PO"
            value={`${lot.values.supplier} · ${lot.poId}`}
          />
          <Read label="ต้นทุน Lot ตามข้อมูลขณะนี้" value={`฿${fmt(c.total)}`} />
          <Read
            label="ต้นทุน / กก. รับกลาง"
            value={c.perKg === null ? "รอรับสต๊อกกลาง" : `฿${fmt(c.perKg)}`}
          />
          <Read
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
              <div className="notice warning">
                Loss เกิน 20% · ตรวจสอบได้โดยไม่หยุดการส่งต่องาน
              </div>
            )}
        </>
      )}
    </section>
  );
}
