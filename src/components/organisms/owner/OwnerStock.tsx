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
  Left,
  StatusCells,
  StockTable,
  type Held,
} from "@/components/organisms/branch/BranchStock";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, dateLabel, qty } from "@/lib/format";
import {
  branchMaterial,
  branches,
  centralPlace,
  materialList,
  placeLabel,
  places,
  projectAssets,
  shopProject,
  stockLines,
} from "@/lib/store";
import { figureGrid } from "./PlTable";

/** A column per place: the central warehouse, then the branches. */
const heads = places.map(placeLabel);
const counted = branches.map(placeLabel);
const transit = "ระหว่างส่ง";
const columns = ["SKU", "รายการ", ...heads, transit, "รวม", "สถานะ"];
// What it is, where it is, what it cost.
const cost = ["ผู้ขาย", "ซื้อล่าสุด", "จำนวนซื้อ", "มูลค่า"];
const bought = [
  "SKU",
  "รายการ",
  "รายละเอียด / สเปก",
  ...heads,
  transit,
  "คงเหลือรวม",
  ...cost,
];
const none = <Muted as="span">—</Muted>;
const blank = <Cell right>{none}</Cell>;
/** What was sent and waits for the branch to confirm: a dash with nothing on its way. */
const Transit = ({ n }: { n: number }) => (
  <Cell right>{n ? qty(n) : none}</Cell>
);

/** Inventory as the Owner and the Account Manager see it: everything the project owns and
 *  where it is. First what Accounting bought for it (`projectAssets`), a table per
 *  ประเภทสินค้า with a row per item, from a printed box to a fridge, each with its SKU's
 *  balance at every place (`stockLines`); then the materials the branches count, a row per
 *  material and a column per place. One search over them all. A purchase is jotted on
 *  Accounting, a move between places with the page's 「จัดสรรสินค้า」 (`transfer`), and the
 *  branch admins count on their own Inventory page; the central warehouse is never counted.
 *  The meat, the sticky rice and the chili are on the Stock page (`OwnerMeatStock`). */
export function OwnerStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const [search, setSearch] = useState("");
  const lines = new Map(stockLines(db, today).map((line) => [line.sku, line]));
  const rows = materialList(db.config).map((m) => ({
    id: m.id,
    // "" until the materials list is saved again (a list stored before SKUs).
    sku: m.sku,
    name: m.name,
    // None for a material without a SKU: nothing was bought or moved under it.
    line: lines.get(m.sku),
    at: Object.fromEntries(
      branches.map((branch): [string, Held] => [
        placeLabel(branch),
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
          // Twelve columns: tighter cells, so a desktop shows them all without scrolling.
          className="md:[&_:is(td,th)]:px-3 [&_:is(td,th)+:is(td,th)]:border-l"
          aside={
            <Caption>
              {group.rows.length} รายการ · {baht(sum(group.rows))}
            </Caption>
          }
        >
          {/* A phone keeps the name and where it is; what it cost is on Accounting. */}
          <StockTable
            columns={bought}
            right={[...heads, transit, "คงเหลือรวม", "จำนวนซื้อ", "มูลค่า"]}
            wideOnly={["SKU", "รายละเอียด / สเปก", ...cost]}
          >
            {group.rows.map((row) => {
              // None for a row without a SKU, or one with no quantity ever typed.
              const line = lines.get(row.sku);
              return (
                <tr key={row.key}>
                  <Cell className="font-mono whitespace-nowrap text-accent max-md:hidden">
                    {row.sku || none}
                  </Cell>
                  <Cell className="font-semibold md:min-w-40">
                    {row.item || none}
                  </Cell>
                  <Cell className="min-w-32 max-md:hidden">
                    {row.detail || none}
                  </Cell>
                  {places.map((place) =>
                    line ? (
                      <Left key={place} n={line.at[place] ?? 0} />
                    ) : (
                      <Cell key={place} right>
                        {none}
                      </Cell>
                    ),
                  )}
                  <Transit n={line?.inTransit ?? 0} />
                  {line ? (
                    <Left
                      n={places.reduce(
                        (sum, place) => sum + (line.at[place] ?? 0),
                        line.inTransit,
                      )}
                    />
                  ) : (
                    blank
                  )}
                  <Cell className="min-w-24 max-md:hidden">
                    {row.vendor || none}
                  </Cell>
                  <Cell className="whitespace-nowrap max-md:hidden">
                    {dateLabel(row.lastDate)}
                    {row.times > 1 && (
                      <span className="block text-caption text-text-secondary">
                        ซื้อ {row.times} ครั้ง
                      </span>
                    )}
                  </Cell>
                  <Cell right className="max-md:hidden">
                    {row.qty === null ? none : qty(row.qty)}
                  </Cell>
                  <Cell right className="max-md:hidden">
                    {baht(row.paid)}
                  </Cell>
                </tr>
              );
            })}
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
        title="วัสดุ · คงเหลือตามที่เก็บ"
        // A light rule between the columns.
        className="[&_:is(td,th)+:is(td,th)]:border-l"
        aside={
          <Caption aria-live="polite">
            แสดง {shown.length} จาก {rows.length} รายการ
          </Caption>
        }
      >
        <StockTable columns={columns} right={[...heads, transit, "รวม"]}>
          {shown.map((row) => (
            <tr key={row.id}>
              <Cell className="font-mono whitespace-nowrap text-accent">
                {row.sku || <Muted as="span">—</Muted>}
              </Cell>
              <Cell className="font-semibold md:whitespace-nowrap">
                {row.name}
              </Cell>
              {row.line ? <Left n={row.line.at[centralPlace]} /> : blank}
              {counted.map((place) => (
                <HeldCell
                  key={place}
                  held={row.at[place]}
                  today={today}
                  varianceUnit="ชิ้น"
                />
              ))}
              <Transit n={row.line?.inTransit ?? 0} />
              <StatusCells
                at={row.at}
                places={counted}
                extra={
                  (row.line?.at[centralPlace] ?? 0) + (row.line?.inTransit ?? 0)
                }
              />
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
        ตารางสินทรัพย์คือของที่ซื้อเข้า Project จากหน้า Accounting
        รวมทุกครั้งที่ซื้อ พร้อมยอดคงเหลือของแต่ละที่ · คลังกลาง = ซื้อเข้า −
        จัดสรรออก ไม่มีการนับ · ระหว่างส่ง = ส่งแล้ว รอสาขากดยืนยันรับ ·
        ยอดรวมนับของระหว่างส่งด้วย ·
        ย้ายของระหว่างคลังกลางกับสาขาด้วยปุ่ม「จัดสรรสินค้า」· ตัวเลขสีแดง =
        ติดลบ · ในตารางวัสดุ ยอดของสาขาคือยอดที่แอดมินสาขานับจากหน้าของสาขา
        นับเป็นชิ้น ช่องสีเหลือง = ยังไม่เคยนับ หรือไม่ได้นับเกิน 7 วัน
        ช่องสีแดง = ไม่เหลือ · ส่วนต่าง = นับได้ − ควรเหลือ ของการนับครั้งล่าสุด
        (ควรเหลือคือยอดที่เว็บคิดไว้ก่อนนับ)
        เริ่มมีส่วนต่างตั้งแต่การนับครั้งที่สอง · เนื้อ ข้าวเหนียว
        และน้ำพริกอยู่ที่หน้า Stock
      </Caption>
    </div>
  );
}
