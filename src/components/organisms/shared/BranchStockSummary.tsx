"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { FilterBar } from "@/components/molecules/FilterBar";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { TableFilter } from "@/components/molecules/TableFilter";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { branchMeatDay, type Database } from "@/lib/store";
import { fmt, today } from "@/lib/format";

const DAYS = 14;
type Day = ReturnType<typeof branchMeatDay>;
const keys = [
  "pending",
  "received",
  "frozen",
  "chillOut",
  "usedTotal",
  "chillIn",
  "thawed",
  "used",
  "waste",
] as const;
const kg = (value: number) => `${fmt(value)} กก.`;
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const sumDays = (days: Day[]) =>
  Object.fromEntries(
    keys.map((key) => [key, days.reduce((s, d) => s + d[key], 0)]),
  ) as Record<(typeof keys)[number], number>;

/** One branch's meat as of the end of a chosen day, per lot (รอรับ / แช่แข็ง / ชิล /
 * ใช้แล้ว plus that day's movement), and the last 14 days for one lot or all lots.
 * Every number is `branchMeatDay` over the entry log. More than one branch shows a
 * branch picker (the Owner view). */
export function BranchStockSummary({
  db,
  branches,
  initialDate = today(),
}: {
  db: Database;
  branches: readonly string[];
  initialDate?: string;
}) {
  const [branch, setBranch] = useState(branches[0] ?? "");
  const [date, setDate] = useState(initialDate);
  const [picked, setPicked] = useState("");
  const all = db.lots.map((lot) => ({
    id: lot.id,
    ...branchMeatDay(db, lot.id, branch, date),
  }));
  const lots = all.filter((d) => keys.some((key) => Math.abs(d[key]) > 0.001));
  const total = sumDays(lots);
  // A lot picked on another date or branch may have nothing here: fall back to all.
  const lotId = lots.some((d) => d.id === picked) ? picked : "";
  const history = Array.from({ length: DAYS }, (_, i) => addDays(date, -i)).map(
    (day) => ({
      day,
      ...sumDays(
        (lotId ? [lotId] : lots.map((d) => d.id)).map((id) =>
          branchMeatDay(db, id, branch, day),
        ),
      ),
    }),
  );
  const row = (d: Record<(typeof keys)[number], number>) =>
    keys.map((key) => kg(d[key]));

  return (
    <>
      <SectionHeading
        title="สรุปคงเหลือเนื้อ รายวัน / รายล็อต"
        description={`ยอด ณ สิ้นวันที่ ${date} · สาขา ${branch}`}
      />
      <FilterBar>
        {branches.length > 1 && (
          <TableFilter label="สาขา">
            <Select
              variant="filter"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branches.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </TableFilter>
        )}
        <TableFilter label="ยอด ณ สิ้นวันที่">
          <Input
            variant="filter"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </TableFilter>
      </FilterBar>
      <DataTable
        title={`คงเหลือแยก Lot · ${date} · ${branch}`}
        columns={[
          "Lot",
          "รอรับ",
          "รับเข้า (สะสม)",
          "แช่แข็ง",
          "ชิล (ละลายแล้วคงเหลือ)",
          "ใช้แล้ว (สะสม)",
          "ชิลยกมา",
          "ละลายวันนี้",
          "ใช้จริงวันนี้",
          "เวสต์วันนี้",
        ]}
        rowKeys={[...lots.map((d) => d.id), "total"]}
        rows={
          lots.length
            ? [
                ...lots.map((d) => [d.id, ...row(d)]),
                [<strong key="total">รวม</strong>, ...row(total)],
              ]
            : []
        }
        // ponytail: no sort ("" is no column), so the รวม row stays last.
        defaultSort={{ column: "" }}
        emptyText="ยังไม่มีเนื้อของสาขานี้ ณ วันที่เลือก"
      />
      <DataTable
        title={`ย้อนหลัง ${DAYS} วัน · ${branch}`}
        action={
          <TableFilter label="Lot">
            <Select
              variant="filter"
              value={lotId}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option value="">ทุก Lot</option>
              {lots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id}
                </option>
              ))}
            </Select>
          </TableFilter>
        }
        columns={[
          "วันที่",
          "ชิลยกมา",
          "ละลาย",
          "ใช้จริง",
          "เวสต์",
          "คงเหลือชิล",
          "แช่แข็งสิ้นวัน",
        ]}
        rowKeys={history.map((h) => h.day)}
        rows={history.map((h) => [
          h.day,
          kg(h.chillIn),
          kg(h.thawed),
          kg(h.used),
          kg(h.waste),
          kg(h.chillOut),
          kg(h.frozen),
        ])}
        emptyText="ยังไม่มีข้อมูลย้อนหลัง"
      />
    </>
  );
}
