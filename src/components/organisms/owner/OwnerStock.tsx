"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Stat } from "@/components/atoms/Stat";
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
import { baht, dateLabel, qty } from "@/lib/format";
import {
  branchMaterial,
  branches,
  materialList,
  projectAssets,
  shopProject,
} from "@/lib/store";
import { figureGrid } from "./PlTable";

/** Materials have no central stock yet: its column is a dash on every row. */
const central = "คลังกลาง";
const places = [central, ...branches.map((branch) => `สาขา${branch}`)];
const columns = ["SKU", "สินค้า", ...places, "รวม", "สถานะ"];
const bought = [
  "SKU",
  "รายการ",
  "รายละเอียด / สเปก",
  "ผู้ขาย",
  "ซื้อล่าสุด",
  "จำนวนซื้อ",
  "มูลค่า",
];
const none = <Muted as="span">—</Muted>;

/** Inventory as the Owner and the Account Manager see it: everything the project owns. First
 *  what Accounting bought for it (`projectAssets`), a table per ประเภทสินค้า with a row per
 *  item, from a printed box to a fridge; then the materials the branches count, a row per
 *  material and a column per place. One search over them all. Read-only: a purchase is
 *  jotted on Accounting, and the branch admins count on their own Inventory page. The meat,
 *  the sticky rice and the chili are on the Stock page (`OwnerMeatStock`). */
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
  const assets = projectAssets(db);
  const all = assets.flatMap((group) => group.rows);
  const groups = assets
    .map((group) => ({
      ...group,
      rows: group.rows.filter(
        (row) =>
          !word ||
          [row.item, row.sku, row.detail, row.vendor].some((text) =>
            text.toLowerCase().includes(word),
          ),
      ),
    }))
    .filter((group) => group.rows.length);
  const sum = (list: typeof all) => list.reduce((a, row) => a + row.paid, 0);

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
      <Panel className={figureGrid} aria-label="สรุปสินทรัพย์ของ Project">
        <Stat
          label={`มูลค่าที่ซื้อเข้า ${shopProject}`}
          value={baht(sum(all))}
          note="ยอดจ่ายจริงจากหน้า Accounting · ไม่รวมที่ยกเลิก"
        />
        <Stat
          label="สินทรัพย์"
          value={`${qty(all.length)} รายการ`}
          note={`${qty(assets.length)} ประเภท`}
        />
      </Panel>
      {groups.map((group) => (
        <DayCard
          key={group.type}
          aria-label={`สินทรัพย์ · ${group.type || "ไม่ระบุประเภท"}`}
          title={group.type || "ไม่ระบุประเภท"}
          className="[&_:is(td,th)+:is(td,th)]:border-l"
          aside={
            <Caption>
              {group.rows.length} รายการ · {baht(sum(group.rows))}
            </Caption>
          }
        >
          {/* A phone keeps the name, the quantity and the value. */}
          <StockTable
            columns={bought}
            right={["จำนวนซื้อ", "มูลค่า"]}
            wideOnly={["SKU", "รายละเอียด / สเปก", "ผู้ขาย", "ซื้อล่าสุด"]}
          >
            {group.rows.map((row) => (
              <tr key={row.key}>
                <Cell className="font-mono whitespace-nowrap text-accent max-md:hidden">
                  {row.sku || none}
                </Cell>
                <Cell className="font-semibold">{row.item || none}</Cell>
                <Cell className="max-md:hidden">{row.detail || none}</Cell>
                <Cell className="max-md:hidden">{row.vendor || none}</Cell>
                <Cell className="whitespace-nowrap max-md:hidden">
                  {dateLabel(row.lastDate)}
                  {row.times > 1 && (
                    <span className="block text-caption text-text-secondary">
                      ซื้อ {row.times} ครั้ง
                    </span>
                  )}
                </Cell>
                <Cell right>{row.qty === null ? none : qty(row.qty)}</Cell>
                <Cell right>{baht(row.paid)}</Cell>
              </tr>
            ))}
          </StockTable>
        </DayCard>
      ))}
      {!groups.length && (
        <Caption>
          {all.length
            ? "ไม่พบสินทรัพย์ที่ตรงกับที่ค้นหา"
            : `ยังไม่มีของที่ซื้อเข้า ${shopProject} · จดที่หน้า Accounting เลือกใช้เพื่องาน「ใช้งานโปรเจกต์」แล้วเลือก Project นี้`}
        </Caption>
      )}
      <DayCard
        aria-label="วัสดุ"
        title="วัสดุ · คงเหลือตามสาขา"
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
        หน้านี้ดูได้อย่างเดียว · ตารางสินทรัพย์คือของที่ซื้อเข้า Project จากหน้า
        Accounting รวมทุกครั้งที่ซื้อ (ซื้อเข้ามาเท่าไร ไม่ใช่เหลือเท่าไร) ·
        ตารางวัสดุคือยอดคงเหลือที่แอดมินสาขานับจากหน้าของสาขา · วัสดุนับเป็นชิ้น
        · ช่องสีเหลือง = ยังไม่เคยนับ หรือไม่ได้นับเกิน 7 วัน · ช่องสีแดง =
        ไม่เหลือ · วัสดุยังไม่มีคลังกลาง ซื้อแล้วเข้าสาขาทันที · ส่วนต่าง =
        นับได้ − ควรเหลือ ของการนับครั้งล่าสุด
        (ควรเหลือคือยอดที่เว็บคิดไว้ก่อนนับ)
        เริ่มมีส่วนต่างตั้งแต่การนับครั้งที่สอง · เนื้อ ข้าวเหนียว
        และน้ำพริกอยู่ที่หน้า Stock
      </Caption>
    </div>
  );
}
