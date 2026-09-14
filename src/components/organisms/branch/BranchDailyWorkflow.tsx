"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { CountPill } from "@/components/atoms/CountPill";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { balance, entries, n, type Database, type Lot } from "@/lib/store";

const taskKeys = ["receive", "thaw", "sale", "close"];

export function BranchDailyWorkflow({ db, branch, date, lots, closed, open }: { db: Database; branch: string; date: string; lots: Lot[]; closed: boolean; open: (kind: string, lotId?: string) => void }) {
  const pending = lots.filter((lot) => entries(db, "allocate", lot.id, branch).reduce((sum, entry) => sum + n(entry.values, "kg"), 0) > balance(db, lot.id, branch).received + 0.001);
  const frozen = lots.filter((lot) => balance(db, lot.id, branch).frozen > 0.001);
  const ready = lots.filter((lot) => balance(db, lot.id, branch).ready > 0.001);
  const saleDone = entries(db, "sale", undefined, branch, date).length > 0;
  const tasks: ReactNode[][] = [
    [<strong key="receive">1. รับเนื้อเข้าสาขา</strong>, pending.length ? <CountPill variant="task" key="new">งานเข้าใหม่ {pending.length} Lot</CountPill> : "ไม่มีรายการรอรับ", pending.length ? <Button variant="table" disabled={closed} onClick={() => open("receive", pending[0].id)}>รับของ</Button> : "-"],
    [<strong key="thaw">2. แบ่งละลายเนื้อ</strong>, frozen.length ? <CountPill variant="task" key="need">ต้องเลือกเนื้อที่จะละลาย</CountPill> : "ไม่มีเนื้อแช่แข็ง", frozen.length ? <Button variant="table" disabled={closed} onClick={() => open("thaw", frozen[0].id)}>แบ่งละลาย</Button> : "-"],
    [<strong key="sale">3. บันทึกยอดขาย</strong>, ready.length && !saleDone ? <CountPill variant="task" key="sales">ต้องกรอกก่อนปิดวัน</CountPill> : saleDone ? "บันทึกแล้ว" : "รอเนื้อพร้อมขาย", ready.length ? <Button variant="table" disabled={closed} onClick={() => open("sale", ready[0].id)}>บันทึกยอดขาย</Button> : "-"],
    [<strong key="close">4. ปิดวัน</strong>, closed ? "ปิดวันแล้ว" : saleDone ? "พร้อมตรวจและปิดวัน" : "รอยอดขาย", <Button key="close-action" variant="table" disabled={closed || !saleDone} onClick={() => open("closeDay")}>ปิดวัน</Button>],
  ];
  return <DataTable title={`งานหลักประจำวัน · ${branch}`} columns={["ลำดับงาน", "สถานะ", "ทำรายการ"]} rowKeys={taskKeys} rows={tasks} />;
}
