"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import {
  Cell,
  HeldCell,
  StatusCells,
  StockTable,
  type Held,
} from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { branchMaterial, branches, materialList } from "@/lib/store";

/** Materials have no central stock yet: its column is a dash on every row. */
const central = "คลังกลาง";
const places = [central, ...branches.map((branch) => `สาขา${branch}`)];
const columns = ["SKU", "สินค้า", ...places, "รวม", "สถานะ"];

/** Inventory as the Owner and the Account Manager see it: one table of the materials, a row
 *  per material and a column per place, with a search. Read-only: the
 *  branch admins count on their own Inventory page. The meat, the sticky rice and the chili
 *  are on the Stock page (`OwnerMeatStock`). */
export function OwnerStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const [search, setSearch] = useState("");
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
  const word = search.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      !word ||
      row.name.toLowerCase().includes(word) ||
      row.sku.toLowerCase().includes(word),
  );

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        variant="filter"
        aria-label="ค้นหา"
        placeholder="ค้นหาสินค้า หรือ SKU"
        className="min-h-11"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
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
                <HeldCell
                  key={place}
                  held={row.at[place]}
                  today={today}
                  varianceUnit="ชิ้น"
                />
              ))}
              <StatusCells at={row.at} places={places} />
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
        ส่วนต่าง = นับได้ − ควรเหลือ ของการนับครั้งล่าสุด
        (ควรเหลือคือยอดที่เว็บคิดไว้ก่อนนับ)
        เริ่มมีส่วนต่างตั้งแต่การนับครั้งที่สอง · เนื้อ ข้าวเหนียว
        และน้ำพริกอยู่ที่หน้า Stock
      </Caption>
    </div>
  );
}
