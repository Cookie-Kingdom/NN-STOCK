"use client";

import { type ReactNode } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { balance, entries, n, type Database, type Lot } from "@/lib/store";

export function BranchDailyWorkflow({ db, branch, date, lots, closed, open }: { db: Database; branch: string; date: string; lots: Lot[]; closed: boolean; open: (kind: string, lotId?: string) => void }) {
  const pending = lots.filter((lot) => entries(db, "allocate", lot.id, branch).reduce((sum, entry) => sum + n(entry.values, "kg"), 0) > balance(db, lot.id, branch).received + 0.001);
  const frozen = lots.filter((lot) => balance(db, lot.id, branch).frozen > 0.001);
  const ready = lots.filter((lot) => balance(db, lot.id, branch).ready > 0.001);
  const saleDone = entries(db, "sale", undefined, branch, date).length > 0;
  const tasks: ReactNode[][] = [
    [<strong key="receive">1. รับเนื้อเข้าสาขา</strong>, pending.length ? <span className="task-alert" key="new">งานเข้าใหม่ {pending.length} Lot</span> : "ไม่มีรายการรอรับ", pending.length ? <button className="table-action" disabled={closed} onClick={() => open("receive", pending[0].id)}>รับของ</button> : "-"],
    [<strong key="thaw">2. แบ่งละลายเนื้อ</strong>, frozen.length ? <span className="task-alert" key="need">ต้องเลือกเนื้อที่จะละลาย</span> : "ไม่มีเนื้อแช่แข็ง", frozen.length ? <button className="table-action" disabled={closed} onClick={() => open("thaw", frozen[0].id)}>แบ่งละลาย</button> : "-"],
    [<strong key="sale">3. บันทึกยอดขาย</strong>, ready.length && !saleDone ? <span className="task-alert" key="sales">ต้องกรอกก่อนปิดวัน</span> : saleDone ? "บันทึกแล้ว" : "รอเนื้อพร้อมขาย", ready.length ? <button className="table-action" disabled={closed} onClick={() => open("sale", ready[0].id)}>บันทึกยอดขาย</button> : "-"],
    [<strong key="close">4. ปิดวัน</strong>, closed ? "ปิดวันแล้ว" : saleDone ? "พร้อมตรวจและปิดวัน" : "รอยอดขาย", <button key="close-action" className="table-action" disabled={closed || !saleDone} onClick={() => open("closeDay")}>ปิดวัน</button>],
  ];
  return <DataTable title={`งานหลักประจำวัน · ${branch}`} columns={["ลำดับงาน", "สถานะ", "ทำรายการ"]} rows={tasks} />;
}
