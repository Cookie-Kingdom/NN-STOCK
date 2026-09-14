"use client";

import { useState } from "react";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { branches, entries, titles, type Database } from "@/lib/store";

export function OwnerDailyStatus({ db, date }: { db: Database; date: string }) {
  const [branchFilter, setBranchFilter] = useState("ทั้งหมด");
  const defaultStart = new Date(`${date}T00:00:00Z`);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().slice(0, 10));
  const required = (name: string) =>
    name === "มีนบุรี"
      ? ["ricePurchase", "riceCarry", "materials", "sale", "closeDay"]
      : ["riceIssue", "rice", "materials", "sale", "closeDay"];
  const dayNumber = (value: string) =>
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(5, 7)) - 1,
      Number(value.slice(8, 10)),
    );
  const visibleBranches =
    branchFilter === "ทั้งหมด" ? branches : [branchFilter];
  const dates: string[] = [];
  for (let cursor = dayNumber(startDate); cursor <= dayNumber(date); cursor += 86400000)
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  const rows = visibleBranches.flatMap((name) =>
    dates.flatMap((workDate) => {
      const missing = required(name).filter(
        (kind) => !entries(db, kind, undefined, name, workDate).length,
      );
      if (!missing.length)
        return [[
          workDate,
          <strong key={`${name}-${workDate}`}>{name}</strong>,
          "กรอกครบทุกหัวข้อ",
          "0 วัน",
          <span className="badge" key="complete">ครบแล้ว</span>,
        ]];
      return missing.map((kind) => [
        workDate,
        <strong key={`${name}-${workDate}-${kind}`}>{name}</strong>,
        titles[kind],
        `${Math.max(1, Math.round((dayNumber(date) - dayNumber(workDate)) / 86400000))} วัน`,
        <span className="badge danger" key="pending">ค้างกรอก</span>,
      ]);
    }),
  );
  return (
    <DataTable
      title={`ติดตามงานผู้จัดการสาขา · ${startDate} ถึง ${date}`}
      columns={["วันที่", "สาขา", "รายการ", "ค้างมาแล้ว", "สถานะ"]}
      rows={rows}
      action={
        <div className="table-filters">
        <label className="table-filter">ตั้งแต่
          <input type="date" max={date} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className="table-filter">สาขา
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
          >
            <option>ทั้งหมด</option>
            {branches.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label></div>
      }
    />
  );
}
