"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { TableFilter } from "@/components/molecules/TableFilter";
import { Cell, StockTable } from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty } from "@/lib/format";
import { branchMaterial, branches, materialList } from "@/lib/store";

type Tone = "success" | "warning" | "danger";

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
    sku: m.id.toUpperCase(),
    name: m.name,
    /** What is left at each branch; `stale` says why its count is late. */
    at: Object.fromEntries(
      branches.map((branch) => {
        const s = branchMaterial(db, branch, m.id, today);
        return [
          `สาขา${branch}`,
          {
            left: s.qty,
            stale: !s.stale
              ? undefined
              : s.countedOn
                ? "เกิน 7 วัน"
                : "ยังไม่เคยนับ",
          },
        ];
      }),
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
          {shown.map((row) => {
            const total = places.reduce(
              (sum, place) => sum + (row.at[place]?.left ?? 0),
              0,
            );
            const late = places.filter((place) => row.at[place]?.stale);
            const [tone, text]: [Tone, string] =
              total <= 0
                ? ["danger", "หมด"]
                : late.length
                  ? ["warning", `ยังไม่ได้นับ: ${late.join(", ")}`]
                  : ["success", "พร้อมใช้"];
            return (
              <tr key={row.sku}>
                <Cell className="font-mono whitespace-nowrap text-accent">
                  {row.sku}
                </Cell>
                <Cell className="font-semibold md:whitespace-nowrap">
                  {row.name}
                </Cell>
                {places.map((place) => {
                  const h = row.at[place];
                  return h ? (
                    <Cell
                      key={place}
                      right
                      tone={
                        h.left <= 0 ? "danger" : h.stale ? "warning" : undefined
                      }
                    >
                      {qty(h.left)}
                      {h.stale && (
                        <span className="block text-caption font-normal">
                          {h.stale}
                        </span>
                      )}
                    </Cell>
                  ) : (
                    <Cell key={place} right>
                      <Muted as="span">—</Muted>
                    </Cell>
                  );
                })}
                {!where && (
                  <Cell right tone={total < 0 ? "danger" : undefined}>
                    {qty(total)}
                  </Cell>
                )}
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
        หน้านี้ดูได้อย่างเดียว แอดมินสาขาเป็นคนนับจากหน้าของสาขา · ช่องสีเหลือง
        = ยังไม่เคยนับ หรือไม่ได้นับเกิน 7 วัน · ช่องสีแดง = ไม่เหลือ ·
        วัสดุยังไม่มีคลังกลาง ซื้อแล้วเข้าสาขาทันที · เนื้อ ข้าวเหนียว
        และน้ำพริกอยู่ที่หน้า Stock
      </Caption>
    </div>
  );
}
