"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Input } from "@/components/atoms/Input";
import { BranchSelectFilter } from "@/components/molecules/BranchSelectFilter";
import { FilterBar } from "@/components/molecules/FilterBar";
import { TableFilter } from "@/components/molecules/TableFilter";
import {
  requiredDailyKinds,
  sevenDayRangeStart,
} from "@/components/organisms/owner/ownerDaily";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { branches, entries, titles, type Database } from "@/lib/store";

const columns = ["วันที่", "สาขา", "รายการ", "ค้างมาแล้ว", "สถานะ"];
const dayMs = 86400000;

function dayNumber(value: string) {
  return Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}

export function OwnerDailyStatus({ db, date }: { db: Database; date: string }) {
  const [branchFilter, setBranchFilter] = useState("ทั้งหมด");
  const [startDate, setStartDate] = useState(() => sevenDayRangeStart(date));
  const visibleBranches =
    branchFilter === "ทั้งหมด" ? branches : [branchFilter];
  const dates: string[] = [];
  for (
    let cursor = dayNumber(startDate);
    cursor <= dayNumber(date);
    cursor += dayMs
  )
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  const rows = visibleBranches.flatMap((name) =>
    dates.flatMap((workDate) => {
      const missing = requiredDailyKinds(db, name, workDate).filter(
        (kind) => !entries(db, kind, undefined, name, workDate).length,
      );
      if (!missing.length)
        return [
          [
            workDate,
            <strong key={`${name}-${workDate}`}>{name}</strong>,
            "กรอกครบทุกหัวข้อ",
            "0 วัน",
            <Badge tone="success" key="complete">
              ครบแล้ว
            </Badge>,
          ],
        ];
      return missing.map((kind) => [
        workDate,
        <strong key={`${name}-${workDate}-${kind}`}>{name}</strong>,
        titles[kind],
        `${Math.max(1, Math.round((dayNumber(date) - dayNumber(workDate)) / dayMs))} วัน`,
        <Badge tone="danger" key="pending">
          ค้างกรอก
        </Badge>,
      ]);
    }),
  );
  return (
    <DataTable
      title={`ติดตามงานผู้จัดการสาขา · ${startDate} ถึง ${date}`}
      columns={columns}
      rows={rows}
      action={
        <FilterBar>
          <TableFilter label="ตั้งแต่">
            <Input
              variant="filter"
              type="date"
              max={date}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </TableFilter>
          <BranchSelectFilter
            value={branchFilter}
            onChange={setBranchFilter}
            branches={branches}
          />
        </FilterBar>
      }
    />
  );
}
