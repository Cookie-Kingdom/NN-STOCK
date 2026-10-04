"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { TableFilter } from "@/components/molecules/TableFilter";
import {
  Cell,
  Left,
  StockTable,
} from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty } from "@/lib/format";
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
/** What is left at one place; `stale` says why its count is late. */
type Held = { left: number; stale?: string };
type Row = {
  sku: string;
  name: string;
  type: "วัสดุ" | "น้ำพริก";
  /** By place; a place the item cannot be at has no key. */
  at: Record<string, Held>;
};

/** Materials and chili have no central stock yet: its column is a dash on every row. */
const central = "คลังกลาง";
const branchPlaces = branches.map((branch) => `สาขา${branch}`);
const none = <Muted as="span">—</Muted>;

/** Inventory as the Owner and the Account Manager see it: the meat from the seller to each
 *  branch (V2-CAL-07, 08, 10), then one table of the materials and chili, a row per item and
 *  a column per place, with a search and a filter by type and by place. Read-only: the
 *  branch admins count on their own Inventory page. */
export function OwnerStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [where, setWhere] = useState("");
  const held = purchaseLots(db)
    .map((lot) => ({ lot, kg: poInfo(db, lot.id).heldKg }))
    .filter((po) => po.kg > 0);
  const smoked = shipments(db)
    .map((lot) => lotInfo(db, lot.id))
    .filter((info) => info.backKg > 0);
  /** A row with a figure per branch. */
  const perBranch = (
    row: Omit<Row, "at">,
    left: (branch: string) => Held,
  ): Row => ({
    ...row,
    at: Object.fromEntries(
      branches.map((branch) => [`สาขา${branch}`, left(branch)]),
    ),
  });

  const rows: Row[] = [
    ...materialList(db.config).map((m) =>
      perBranch(
        { sku: m.id.toUpperCase(), name: m.name, type: "วัสดุ" },
        (branch) => {
          const s = branchMaterial(db, branch, m.id, today);
          return {
            left: s.qty,
            stale: !s.stale
              ? undefined
              : s.countedOn
                ? "เกิน 7 วัน"
                : "ยังไม่เคยนับ",
          };
        },
      ),
    ),
    // Chili is counted in the sale form and has no 7-day rule (V2-CAL-12): never yellow.
    perBranch({ sku: "CHILI", name: "น้ำพริก", type: "น้ำพริก" }, (branch) => ({
      left: branchChili(db, branch).qty,
    })),
  ];
  // One place picked: its column alone, and the rows that can be there.
  const places = where ? [where] : [central, ...branchPlaces];
  const columns = [
    "SKU",
    "สินค้า",
    "ประเภท",
    ...places,
    ...(where ? [] : ["รวม"]),
    "สถานะ",
  ];
  const word = search.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (!type || row.type === type) &&
      (!where || row.at[where]) &&
      (!word ||
        row.name.toLowerCase().includes(word) ||
        row.sku.toLowerCase().includes(word)),
  );

  return (
    <div className="flex flex-col gap-4">
      <DayCard
        aria-label="เนื้อ (กก.)"
        title="เนื้อ (กก.)"
        aside={<Caption>ตั้งแต่ร้านขายเนื้อจนถึงสาขา</Caption>}
      >
        <StockTable
          columns={["อยู่ที่ไหน", "รายการ", "คงเหลือ", "การนับ"]}
          right={["คงเหลือ"]}
        >
          {held.map(({ lot, kg }) => (
            <tr key={lot.id}>
              <Cell>ฝากไว้ที่ร้านขายเนื้อ</Cell>
              <Cell>
                {[lot.poId, lot.values.supplier].filter(Boolean).join(" · ")}
              </Cell>
              <Left n={kg} />
              <Cell />
            </tr>
          ))}
          {smoked.map((info) => (
            <tr key={info.lot.id}>
              <Cell>สต๊อกกลาง</Cell>
              <Cell>{info.lot.poId}</Cell>
              <Left n={info.centralKg} />
              <Cell />
            </tr>
          ))}
          {branches.map((branch) => {
            const meat = branchMeat(db, branch, today);
            return (
              <tr key={branch}>
                <Cell>สาขา{branch}</Cell>
                <Cell>เนื้อพร้อมขาย</Cell>
                <Left n={meat.kg} />
                <Cell tone={meat.countedToday ? "success" : "warning"}>
                  {meat.countedToday ? "นับแล้ววันนี้" : "วันนี้ยังไม่ได้นับ"}
                </Cell>
              </tr>
            );
          })}
        </StockTable>
      </DayCard>
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
            {[central, ...branchPlaces].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
        </TableFilter>
      </div>
      <DayCard
        aria-label="วัสดุและน้ำพริก"
        title="วัสดุและน้ำพริก"
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
                <Cell className="whitespace-nowrap">{row.type}</Cell>
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
                      {none}
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
        = ยังไม่ได้นับ (เนื้อ: วันนี้ · วัสดุ: เกิน 7 วัน) · ช่องสีแดง =
        ไม่เหลือ · วัสดุและน้ำพริกยังไม่มีคลังกลาง ซื้อแล้วเข้าสาขาทันที
      </Caption>
    </div>
  );
}
