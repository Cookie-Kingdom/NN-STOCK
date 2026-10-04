"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { TableFilter } from "@/components/molecules/TableFilter";
import { Cell, StockTable } from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty as fmt, thaiDay } from "@/lib/format";
import { branchMaterial, branches, materialList } from "@/lib/store";

/** What is left at one place and its last count (`branchMaterial`, `branchChili`). */
export type Held = { qty: number; countedOn: string; stale: boolean };

/** One place's cell of a row: the figure, and under it the last count. Red with nothing
 *  left, yellow with a late count; no cell at all (a dash) where the item cannot be. */
export function HeldCell({ held, today }: { held?: Held; today: string }) {
  if (!held)
    return (
      <Cell right>
        <Muted as="span">—</Muted>
      </Cell>
    );
  const { qty, countedOn, stale } = held;
  return (
    <Cell right tone={qty <= 0 ? "danger" : stale ? "warning" : undefined}>
      {fmt(qty)}
      <span className="block text-caption font-normal">
        {!countedOn
          ? "ยังไม่เคยนับ"
          : countedOn === today
            ? "นับวันนี้"
            : `นับ ${thaiDay(countedOn)}${stale ? " · เกิน 7 วัน" : ""}`}
      </span>
    </Cell>
  );
}

/** A row's total and status over `places`: out, a late count somewhere, or ready. */
export function StatusCells({
  at,
  places,
  total: showTotal = true,
}: {
  at: Record<string, Held>;
  places: string[];
  /** The total's cell, before the status. */
  total?: boolean;
}) {
  const total = places.reduce((sum, place) => sum + (at[place]?.qty ?? 0), 0);
  const late = places.filter((place) => at[place]?.stale);
  return (
    <>
      {showTotal && (
        <Cell right tone={total < 0 ? "danger" : undefined}>
          {fmt(total)}
        </Cell>
      )}
      <Cell
        tone={total <= 0 ? "danger" : late.length ? "warning" : "success"}
        className="whitespace-nowrap"
      >
        {total <= 0
          ? "หมด"
          : late.length
            ? `ยังไม่ได้นับ: ${late.join(", ")}`
            : "พร้อมใช้"}
      </Cell>
    </>
  );
}

/** Materials have no central stock yet: its column is a dash on every row. */
const central = "คลังกลาง";
const branchPlaces = branches.map((branch) => `สาขา${branch}`);

/** Inventory as the Owner and the Account Manager see it: one table of the materials, a row
 *  per material and a column per place, with a search and a filter by place. Read-only: the
 *  branch admins count on their own Inventory page. The meat, the sticky rice and the chili
 *  are on the Stock page (`OwnerMeatStock`). */
export function OwnerStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const [search, setSearch] = useState("");
  const [where, setWhere] = useState("");
  const rows = materialList(db.config).map((m) => ({
    id: m.id,
    // "" until the materials list is saved again (a list stored before SKUs).
    sku: m.sku,
    name: m.name,
    at: Object.fromEntries(
      branches.map((branch): [string, Held] => [
        `สาขา${branch}`,
        branchMaterial(db, branch, m.id, today),
      ]),
    ),
  }));
  // One place picked: its column alone, and the rows that can be there.
  const places = where ? [where] : [central, ...branchPlaces];
  const columns = [
    "SKU",
    "สินค้า",
    ...places,
    ...(where ? [] : ["รวม"]),
    "สถานะ",
  ];
  const word = search.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (!where || row.at[where]) &&
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
        <TableFilter label="อยู่ที่">
          <Select
            variant="filter"
            className="min-h-11"
            value={where}
            onChange={(event) => setWhere(event.target.value)}
          >
            <option value="">ทุกที่</option>
            {[central, ...branchPlaces].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
        </TableFilter>
      </div>
      <DayCard
        aria-label="วัสดุ"
        title="วัสดุ"
        // A light rule between the columns.
        className="[&_:is(td,th)+:is(td,th)]:border-l"
        aside={
          <Caption aria-live="polite">
            แสดง {shown.length} จาก {rows.length} รายการ
          </Caption>
        }
      >
        <StockTable columns={columns} right={[...places, "รวม"]}>
          {shown.map((row) => (
            <tr key={row.id}>
              <Cell className="font-mono whitespace-nowrap text-accent">
                {row.sku || <Muted as="span">—</Muted>}
              </Cell>
              <Cell className="font-semibold md:whitespace-nowrap">
                {row.name}
              </Cell>
              {places.map((place) => (
                <HeldCell key={place} held={row.at[place]} today={today} />
              ))}
              <StatusCells at={row.at} places={places} total={!where} />
            </tr>
          ))}
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
        หน้านี้ดูได้อย่างเดียว แอดมินสาขาเป็นคนนับจากหน้าของสาขา ·
        วัสดุนับเป็นชิ้น · ช่องสีเหลือง = ยังไม่เคยนับ หรือไม่ได้นับเกิน 7 วัน ·
        ช่องสีแดง = ไม่เหลือ · วัสดุยังไม่มีคลังกลาง ซื้อแล้วเข้าสาขาทันที ·
        เนื้อ ข้าวเหนียว และน้ำพริกอยู่ที่หน้า Stock
      </Caption>
    </div>
  );
}
