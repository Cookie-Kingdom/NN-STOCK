"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { TableFilter } from "@/components/molecules/TableFilter";
import { Cell, StockTable } from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty, thaiDay } from "@/lib/format";
import {
  branchChili,
  branchMaterial,
  branchMeat,
  branches,
  lotInfo,
  materialList,
  poInfo,
  purchaseLots,
  shipments,
} from "@/lib/store";

type Tone = "success" | "warning" | "danger";
type Row = {
  /** Empty when the item has no code of its own. */
  sku: string;
  name: string;
  type: "เนื้อ" | "วัสดุ" | "น้ำพริก";
  left: number;
  unit?: string;
  where: string;
  /** The stale wording; unset when the item is counted in time, or is never counted. */
  stale?: string;
  /** The last count, said after 「พร้อมใช้」. */
  counted?: string;
};

const seller = "ร้านขายเนื้อ",
  central = "คลังกลาง";
const columns = ["SKU", "สินค้า", "ประเภท", "คงเหลือ", "อยู่ที่", "สถานะ"];

/** Nothing left is red, a late count is yellow, the rest is green. */
const status = (row: Row): [Tone, string] =>
  row.left <= 0
    ? ["danger", "หมด"]
    : row.stale
      ? ["warning", row.stale]
      : ["success", row.counted ? `พร้อมใช้ · ${row.counted}` : "พร้อมใช้"];

/** Inventory as the Owner and the Account Manager see it: one table of everything in stock
 *  (the meat from the seller to each branch, V2-CAL-07, 08, 10, then every branch's materials
 *  and chili), with a search and a filter by type and by where it is. Read-only: the branch
 *  admins count on their own Inventory page. */
export function OwnerStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [where, setWhere] = useState("");
  const countedOn = (date: string) =>
    date === today ? "นับวันนี้" : `นับ ${thaiDay(date)}`;

  const rows: Row[] = [
    ...purchaseLots(db).flatMap((lot): Row[] => {
      const left = poInfo(db, lot.id).heldKg;
      return left > 0
        ? [
            {
              sku: lot.poId,
              name: ["เนื้อฝากไว้", lot.values.supplier]
                .filter(Boolean)
                .join(" · "),
              type: "เนื้อ",
              left,
              unit: "กก.",
              where: seller,
            },
          ]
        : [];
    }),
    ...shipments(db).flatMap((lot): Row[] => {
      const info = lotInfo(db, lot.id);
      return info.backKg > 0
        ? [
            {
              sku: lot.poId,
              name: "เนื้อรมควัน",
              type: "เนื้อ",
              left: info.centralKg,
              unit: "กก.",
              where: central,
            },
          ]
        : [];
    }),
    ...branches.flatMap((branch): Row[] => {
      const meat = branchMeat(db, branch, today);
      const chili = branchChili(db, branch);
      const at = `สาขา${branch}`;
      return [
        {
          sku: "",
          name: "เนื้อพร้อมขาย",
          type: "เนื้อ",
          left: meat.kg,
          unit: "กก.",
          where: at,
          stale: meat.countedToday ? undefined : "วันนี้ยังไม่ได้นับ",
          counted: "นับวันนี้",
        },
        ...materialList(db.config).map((m): Row => {
          const s = branchMaterial(db, branch, m.id, today);
          return {
            sku: m.id.toUpperCase(),
            name: m.name,
            type: "วัสดุ",
            left: s.qty,
            where: at,
            stale: !s.stale
              ? undefined
              : s.countedOn
                ? `นับล่าสุด ${thaiDay(s.countedOn)} · เกิน 7 วัน`
                : "ยังไม่เคยนับ",
            counted: s.countedOn && countedOn(s.countedOn),
          };
        }),
        // Chili is counted in the sale form and has no 7-day rule (V2-CAL-12): never yellow.
        {
          sku: "CHILI",
          name: "น้ำพริก",
          type: "น้ำพริก",
          left: chili.qty,
          unit: "หลอด",
          where: at,
          counted: chili.countedOn && countedOn(chili.countedOn),
        },
      ];
    }),
  ];
  const word = search.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (!type || row.type === type) &&
      (!where || row.where === where) &&
      (!word ||
        row.name.toLowerCase().includes(word) ||
        row.sku.toLowerCase().includes(word)),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Input
          type="search"
          variant="filter"
          aria-label="ค้นหา"
          placeholder="ค้นหาสินค้า หรือ SKU"
          className="min-h-11 min-w-64 flex-1 max-md:basis-full"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TableFilter label="ประเภท">
          <Select
            variant="filter"
            className="min-h-11"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">ทุกประเภท</option>
            {[...new Set(rows.map((row) => row.type))].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
        </TableFilter>
        <TableFilter label="อยู่ที่">
          <Select
            variant="filter"
            className="min-h-11"
            value={where}
            onChange={(event) => setWhere(event.target.value)}
          >
            <option value="">ทุกที่</option>
            {[seller, central, ...branches.map((b) => `สาขา${b}`)].map(
              (name) => (
                <option key={name}>{name}</option>
              ),
            )}
          </Select>
        </TableFilter>
      </div>
      <DayCard
        aria-label="สินค้าคงคลัง"
        title="สินค้าคงคลัง"
        aside={
          <Caption aria-live="polite">
            แสดง {shown.length} จาก {rows.length} รายการ
          </Caption>
        }
      >
        <StockTable columns={columns} right={["คงเหลือ"]}>
          {shown.map((row) => {
            const [tone, text] = status(row);
            return (
              <tr key={`${row.where}|${row.sku}|${row.name}`}>
                <Cell className="whitespace-nowrap">
                  {row.sku || <Muted as="span">—</Muted>}
                </Cell>
                <Cell className="font-medium md:whitespace-nowrap">
                  {row.name}
                </Cell>
                <Cell className="whitespace-nowrap">{row.type}</Cell>
                <Cell right tone={row.left < 0 ? "danger" : undefined}>
                  {qty(row.left)}
                  {row.unit && ` ${row.unit}`}
                </Cell>
                <Cell className="whitespace-nowrap">{row.where}</Cell>
                <Cell tone={tone} className="whitespace-nowrap">
                  {text}
                </Cell>
              </tr>
            );
          })}
          {shown.length === 0 && (
            <tr>
              <Cell
                colSpan={columns.length}
                className="py-8 text-center text-text-secondary"
              >
                ไม่พบรายการที่ตรงกับที่ค้นหา
              </Cell>
            </tr>
          )}
        </StockTable>
      </DayCard>
      <Caption>
        หน้านี้ดูได้อย่างเดียว แอดมินสาขาเป็นคนนับจากหน้าของสาขา · ไม่ได้นับเกิน
        7 วันขึ้นสีเหลือง · วัสดุและน้ำพริกยังไม่มีคลังกลาง
        ซื้อแล้วเข้าสาขาทันที
      </Caption>
    </div>
  );
}
