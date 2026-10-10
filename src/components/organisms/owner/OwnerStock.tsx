"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Stat } from "@/components/atoms/Stat";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { TableFilter } from "@/components/molecules/TableFilter";
import {
  Cell,
  Left,
  StockTable,
} from "@/components/organisms/branch/BranchStock";
import { td, tf } from "@/components/organisms/shared/tableCell";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, dateLabel, qty } from "@/lib/format";
import {
  branchItem,
  branches,
  materialList,
  placeLabel,
  places,
  projectAssets,
  shopProject,
  stockLines,
  titles,
  type Material,
  type ProjectAsset,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { SheetCells, SheetStatus, WasteWeekCard } from "./OwnerMeatStock";
import { figureGrid } from "./PlTable";

/** A column per place: the central warehouse, then the branches. */
const heads = places.map(placeLabel);
const transit = "ระหว่างส่ง";
// What it is, where it is, what it cost.
const what = ["SKU", "รายการ", "ประเภท", "รายละเอียด / สเปก"];
const where = [...heads, transit, "รวม", "สถานะ"];
const cost = ["ผู้ขาย", "วันที่ซื้อล่าสุด", "จำนวนซื้อ", "มูลค่า"];
const all = { value: "", label: "ทั้งหมด" };
/** The สถานะ filter: whether a material is left anywhere (or was never set), and a balance
 *  below zero. */
const negative = "ติดลบ";
const unset = "ยังไม่ตั้งยอด";
const statuses = ["พร้อมใช้", "หมด", unset, negative];
const none = <Muted as="span">—</Muted>;
const blank = <Cell right>{none}</Cell>;
/** What was sent and waits for the branch to confirm: a dash with nothing on its way. */
const Transit = ({ n }: { n: number }) => (
  <Cell right>{n ? qty(n) : none}</Cell>
);

/** A row of the table: what was bought under its SKU (`times` 0: never), its ประเภทสินค้า,
 *  for a row of the material list the `material` (a branch's cell is then its daily sheet's),
 *  and what it holds at every place and on its way (`held`, by the column's name). `unset`: a
 *  material no branch ever set or moved (`branchItem`'s `set`), with none in the central
 *  warehouse or on its way: its 0 is no figure yet. */
type Row = ProjectAsset & {
  type: string;
  material?: Material;
  held: Record<string, number>;
  unset: boolean;
};

/** Inventory as the Owner sees it: everything the project owns and where it is, in one table with a row per item (its SKU). A row of the material list holds
 *  at a branch what its daily sheet says is left, with today's waste (V2-CAL-10), the day's
 *  status of each branch at the table's head and the waste of the last 7 days under it;
 *  anything else Accounting bought for the project
 *  (`projectAssets`), from a printed box to a fridge, its SKU's balance at every place
 *  (`stockLines`); a material that was also bought is one row with both. A search and the
 *  ประเภท, สถานะ and ที่เก็บ filters over it, the totals of the rows shown at its foot. A
 *  purchase is jotted on Accounting, a move between places with 「จัดสรรสินค้า」 (`transfer`)
 *  beside the figures, and a branch saves its sheet on its own Inventory page: the Owner only
 *  reads it. The meat, the sticky rice and the chili are on the Stock page
 *  (`OwnerMeatStock`). */
export function OwnerStock({ ws }: { ws: Workspace }) {
  const { db, today } = ws;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [place, setPlace] = useState("");
  const lines = new Map(stockLines(db, today).map((line) => [line.sku, line]));
  const bought = new Map<string, Omit<Row, "held" | "unset">>();
  for (const group of projectAssets(db))
    for (const asset of group.rows) {
      const row = bought.get(asset.key);
      // One row per item: bought under a second ประเภท, it adds to the first.
      if (row) {
        row.paid += asset.paid;
        row.times += asset.times;
        if (asset.qty !== null) row.qty = (row.qty ?? 0) + asset.qty;
      } else
        bought.set(asset.key, {
          ...asset,
          type: group.type || "ไม่ระบุประเภท",
        });
    }
  const materials = materialList(db);
  const rows: Row[] = [
    ...materials.map((m) => ({
      // "" until the materials list is saved again (a list stored before SKUs): nothing was
      // bought or moved under it.
      ...((m.sku && bought.get(m.sku)) || {
        key: m.id,
        sku: m.sku,
        detail: "",
        vendor: "",
        lastDate: "",
        qty: null,
        paid: 0,
        times: 0,
        type: "วัสดุ",
      }),
      item: m.name,
      material: m,
    })),
    ...[...bought.values()].filter(
      (row) => !row.sku || materials.every((m) => m.sku !== row.sku),
    ),
  ].map((row) => {
    // None for a row without a SKU, or one with no quantity ever typed.
    const line = lines.get(row.sku);
    const { material } = row;
    // A material: each branch's daily sheet.
    const sheets = new Map(
      material
        ? branches.map((b) => [b, branchItem(db, b, material.id, today)])
        : [],
    );
    const held = {
      ...Object.fromEntries(
        places.map((p) => [
          placeLabel(p),
          sheets.get(p)?.remaining ?? line?.at[p] ?? 0,
        ]),
      ),
      [transit]: line?.inTransit ?? 0,
    };
    return {
      ...row,
      held,
      unset:
        !!material &&
        [...sheets.values()].every((sheet) => !sheet.set) &&
        Object.values(held).every((n) => n === 0),
    };
  });
  const totalOf = (row: Row) =>
    Object.values(row.held).reduce((a, n) => a + n, 0);
  /** A material's status; "" for anything else. */
  const statusOf = (row: Row) =>
    !row.material
      ? ""
      : row.unset
        ? unset
        : totalOf(row) <= 0
          ? "หมด"
          : "พร้อมใช้";
  const types = [...new Set(rows.map((row) => row.type))];
  const word = search.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (!type || row.type === type) &&
      (!status ||
        (status === negative
          ? Object.values(row.held).some((n) => n < 0)
          : statusOf(row) === status)) &&
      (!place || row.held[place] !== 0) &&
      (!word ||
        [row.item, row.sku, row.detail, row.vendor].some((text) =>
          text.toLowerCase().includes(word),
        )),
  );
  const { limit, more } = useShowMore([type, status, place, word].join("|"));
  const sum = (list: { paid: number }[]) =>
    list.reduce((a, row) => a + row.paid, 0);
  const columns = [...what, ...where, ...cost];
  // A phone keeps the name and where it is.
  const wideOnly = ["SKU", "ประเภท", "รายละเอียด / สเปก", ...cost];
  const wide = (column: string) => wideOnly.includes(column) && "max-md:hidden";

  return (
    <div className="flex flex-col gap-4">
      <Panel className={figureGrid} aria-label="สรุปสินทรัพย์ของ Project">
        <Stat
          label={`มูลค่าของที่ซื้อเข้า ${shopProject}`}
          value={baht(sum([...bought.values()]))}
          note="ยอดจ่ายจริงจากหน้า Accounting ไม่รวมรายการที่ยกเลิก"
        />
        <Stat
          label="สินทรัพย์"
          value={`${qty(bought.size)} รายการ`}
          note={`${qty(new Set([...bought.values()].map((row) => row.type)).size)} ประเภท`}
        />
        {/* The page's jot button (the shell draws none here): a tile of the row, so it is
            as easy to find as the figures. */}
        <div
          role="group"
          aria-label="จดบันทึก"
          className="grid max-md:col-span-2"
        >
          <Button
            variant="primary"
            icon={<Plus />}
            className="h-full"
            onClick={() => ws.jot({ kind: "transfer" })}
          >
            {titles.transfer}
          </Button>
        </div>
      </Panel>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Input
          type="search"
          variant="filter"
          aria-label="ค้นหา"
          placeholder="ค้นหารายการ หรือ SKU"
          className="min-w-64 flex-1 max-md:basis-full"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TableFilter label="ประเภท">
          <Select
            variant="filter"
            value={type}
            onChange={setType}
            options={[all, ...types.map((value) => ({ value }))]}
          />
        </TableFilter>
        <TableFilter label="สถานะ">
          <Select
            variant="filter"
            value={status}
            onChange={setStatus}
            options={[all, ...statuses.map((value) => ({ value }))]}
          />
        </TableFilter>
        {/* The rows that hold something there (a balance that is not zero). */}
        <TableFilter label="ที่เก็บ">
          <Select
            variant="filter"
            value={place}
            onChange={setPlace}
            options={[all, ...[...heads, transit].map((value) => ({ value }))]}
          />
        </TableFilter>
      </div>
      <DayCard
        aria-label="รายการทั้งหมด"
        title="รายการทั้งหมด"
        // Up to fourteen columns: tighter cells, and a light rule between them.
        className="md:[&_:is(td,th)]:px-2 [&_:is(td,th)+:is(td,th)]:border-l"
        aside={
          <>
            <SheetStatus db={db} sheet="materials" today={today} />
            <Caption aria-live="polite">
              {shown.length} จาก {rows.length} รายการ
            </Caption>
          </>
        }
      >
        <StockTable
          columns={columns}
          right={[...heads, transit, "รวม", "จำนวนซื้อ", "มูลค่า"]}
          wideOnly={wideOnly}
          foot={
            shown.length > 0 && (
              <tr>
                {columns.map((column) => (
                  <td
                    key={column}
                    className={cn(
                      td,
                      tf,
                      "whitespace-nowrap",
                      wide(column),
                      column === "มูลค่า" && "text-right",
                    )}
                  >
                    {column === "รายการ"
                      ? `รวม ${shown.length} รายการ`
                      : column === "มูลค่า" && baht(sum(shown))}
                  </td>
                ))}
              </tr>
            )
          }
        >
          {shown.slice(0, limit).map((row) => {
            const line = lines.get(row.sku);
            return (
              <tr key={row.key}>
                <Cell
                  className={cn(
                    "font-mono whitespace-nowrap text-accent",
                    wide("SKU"),
                  )}
                >
                  {row.sku || none}
                </Cell>
                <Cell className="font-semibold md:min-w-32">
                  {row.item || none}
                </Cell>
                <Cell className={cn("whitespace-nowrap", wide("ประเภท"))}>
                  {row.type}
                </Cell>
                <Cell className="min-w-24 max-md:hidden">
                  {row.detail || none}
                </Cell>
                {line ? <Left n={row.held[heads[0]]} /> : blank}
                {branches.map((branch) =>
                  // A material: the branch's daily sheet. Anything else: its balance.
                  row.material ? (
                    <SheetCells
                      key={branch}
                      db={db}
                      branch={branch}
                      item={row.material}
                      today={today}
                      stacked
                    />
                  ) : line ? (
                    <Left key={branch} n={row.held[placeLabel(branch)]} />
                  ) : (
                    <Cell key={branch} right>
                      {none}
                    </Cell>
                  ),
                )}
                <Transit n={row.held[transit]} />
                {row.material ? (
                  <>
                    <Left n={totalOf(row)} />
                    <Cell
                      // Never set: grey, not a warning.
                      tone={
                        row.unset
                          ? undefined
                          : totalOf(row) <= 0
                            ? "danger"
                            : "success"
                      }
                      className={cn(
                        "whitespace-nowrap",
                        row.unset && "text-text-secondary",
                      )}
                    >
                      {statusOf(row)}
                    </Cell>
                  </>
                ) : (
                  <>
                    {line ? <Left n={totalOf(row)} /> : blank}
                    <Cell>{none}</Cell>
                  </>
                )}
                <Cell className="min-w-24 max-md:hidden">
                  {row.vendor || none}
                </Cell>
                <Cell
                  className={cn("whitespace-nowrap", wide("วันที่ซื้อล่าสุด"))}
                >
                  {row.times ? dateLabel(row.lastDate) : none}
                  {row.times > 1 && (
                    <span className="block text-caption text-text-secondary">
                      ซื้อ {row.times} ครั้ง
                    </span>
                  )}
                </Cell>
                <Cell right className="max-md:hidden">
                  {row.qty === null ? none : qty(row.qty)}
                </Cell>
                <Cell right className={cn(wide("มูลค่า"))}>
                  {row.times ? baht(row.paid) : none}
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
                {rows.length
                  ? "ไม่พบรายการที่ค้นหา"
                  : `ยังไม่มีของที่ซื้อเข้า${shopProject} ของที่จดในหน้า Accounting โดยเลือกค่าใช้จ่ายของ "${shopProject}" จะอยู่ในตารางนี้`}
              </Cell>
            </tr>
          )}
        </StockTable>
        <ShowMore
          shown={Math.min(limit, shown.length)}
          total={shown.length}
          onMore={more}
        />
      </DayCard>
      <WasteWeekCard db={db} sheet="materials" today={today} />
      <Caption>
        {
          "หนึ่งแถวคือหนึ่งรายการ ทั้งวัสดุจาก Settings และของที่ซื้อเข้า Project จากหน้า Accounting โดยรวมทุกครั้งที่ซื้อไว้ในแถวเดียว ยอดคลังกลางคือยอดซื้อเข้าลบยอดที่จัดสรรออก ระหว่างส่งคือของที่ส่งแล้วและรอสาขากดยืนยันรับ ช่องรวมนับของระหว่างส่งด้วย ตัวเลขสีแดงคือยอดติดลบ ยอดวัสดุของสาขาคือคงเหลือตามใบสต๊อกรายวันที่ผู้ดูแลสาขาบันทึก (ยอดยกมา + รับเข้า − ใช้ไป − ตัดจากยอดขายตามส่วนประกอบของสินค้าใน Settings) ตามหน่วยของวัสดุนั้น สถานะ ยังไม่ตั้งยอด คือวัสดุที่ยังไม่มีสาขาใดตั้งยอดและยังไม่เคยมีรับเข้าหรือใช้ไป ใต้ตัวเลขคือ Waste ของวันนี้และสาเหตุ วันที่ยังไม่บันทึกจะเป็นยอดล่าสุดที่ยกมา หน้านี้ดูได้อย่างเดียว เนื้อ ข้าวเหนียว และน้ำพริกอยู่ที่หน้า Stock"
        }
      </Caption>
    </div>
  );
}
