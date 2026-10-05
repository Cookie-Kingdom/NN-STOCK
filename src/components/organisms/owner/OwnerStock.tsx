"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Stat } from "@/components/atoms/Stat";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { TableFilter } from "@/components/molecules/TableFilter";
import {
  Cell,
  HeldCell,
  Left,
  StatusCells,
  StockTable,
  type Held,
} from "@/components/organisms/branch/BranchStock";
import { td, tf } from "@/components/organisms/shared/tableCell";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, dateLabel, qty } from "@/lib/format";
import {
  branchMaterial,
  branches,
  editBlock,
  ledgerPurposes,
  materialList,
  placeLabel,
  places,
  projectAssets,
  shopProject,
  stockLines,
  titles,
  voidBlock,
  type Entry,
  type ProjectAsset,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { figureGrid } from "./PlTable";

/** A column per place: the central warehouse, then the branches. */
const heads = places.map(placeLabel);
const counted = branches.map(placeLabel);
const transit = "ระหว่างส่ง";
// What it is, where it is, what it cost.
const what = ["SKU", "รายการ", "ประเภท", "รายละเอียด / สเปก"];
const where = [...heads, transit, "รวม", "สถานะ"];
const cost = ["ผู้ขาย", "ซื้อล่าสุด", "จำนวนซื้อ", "มูลค่า"];
/** The company's last column: 「แก้ไข」 and 「ลบ」 of the row's purchase, as on Accounting. */
const change = "แก้ไข";
const all = { value: "", label: "ทั้งหมด" };
/** The สถานะ filter: what `StatusCells` says of a material, and a balance below zero. */
const late = "ยังไม่ได้นับ";
const negative = "ติดลบ";
const statuses = ["พร้อมใช้", late, "หมด", negative];
const none = <Muted as="span">—</Muted>;
const blank = <Cell right>{none}</Cell>;
/** What was sent and waits for the branch to confirm: a dash with nothing on its way. */
const Transit = ({ n }: { n: number }) => (
  <Cell right>{n ? qty(n) : none}</Cell>
);

/** A row of the table: what was bought under its SKU (`times` 0: never), its ประเภทสินค้า,
 *  for a material of Settings what each branch counted (`at`), and what it holds at every
 *  place and on its way (`held`, by the column's name). */
type Row = Omit<ProjectAsset, "entry"> & {
  /** None for a material never bought. */
  entry?: Entry;
  type: string;
  at?: Record<string, Held>;
  held: Record<string, number>;
};

/** Inventory as the Owner and the Account Manager see it: everything the project owns and
 *  where it is, in one table with a row per item (its SKU). A material of Settings holds
 *  what the branches counted; anything else Accounting bought for the project
 *  (`projectAssets`), from a printed box to a fridge, its SKU's balance at every place
 *  (`stockLines`); a material that was also bought is one row with both. A search and the
 *  ประเภท, สถานะ and ที่เก็บ filters over it, the totals of the rows shown at its foot. A
 *  purchase is jotted on Accounting, a move between places with 「จัดสรรสินค้า」 (`transfer`)
 *  beside the figures, and the branch admins count on their own Inventory page; the central
 *  warehouse is never counted. The meat, the sticky rice and the chili are on the Stock page
 *  (`OwnerMeatStock`).
 *  `company`: the central company's Inventory instead, what Accounting bought with
 *  ใช้เพื่องาน「บริษัทส่วนกลาง」: it has no warehouse, so no place columns, no สถานะ or ที่เก็บ
 *  filter and no transfer; no ผู้ขาย column either, and a last one with 「แก้ไข」 and 「ลบ」
 *  of the row's latest purchase, as on Accounting. */
export function OwnerStock({
  ws,
  company,
}: {
  ws: Workspace;
  company?: boolean;
}) {
  const { db, account, today } = ws;
  const { remove } = useEntryActions(ws);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [place, setPlace] = useState("");
  const owner = company ? ledgerPurposes.company : shopProject;
  const lines = new Map(stockLines(db, today).map((line) => [line.sku, line]));
  const assets = projectAssets(db, company ? null : shopProject);
  const bought = new Map<string, Omit<Row, "held">>();
  for (const group of assets)
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
  const materials = company ? [] : materialList(db.config);
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
      at: Object.fromEntries(
        branches.map((branch): [string, Held] => [
          placeLabel(branch),
          branchMaterial(db, branch, m.id, today),
        ]),
      ),
    })),
    ...[...bought.values()].filter(
      (row) => !row.sku || materials.every((m) => m.sku !== row.sku),
    ),
  ].map((row) => {
    // None for a row without a SKU, or one with no quantity ever typed.
    const line = lines.get(row.sku);
    return {
      ...row,
      held: {
        ...Object.fromEntries(
          places.map((p) => [
            placeLabel(p),
            row.at?.[placeLabel(p)]?.qty ?? line?.at[p] ?? 0,
          ]),
        ),
        [transit]: line?.inTransit ?? 0,
      },
    };
  });
  /** What `StatusCells` shows of a material; "" for anything else. */
  const statusOf = (row: Row) => {
    if (!row.at) return "";
    const total = Object.values(row.held).reduce((a, n) => a + n, 0);
    return total <= 0
      ? "หมด"
      : counted.some((name) => row.at?.[name]?.stale)
        ? late
        : "พร้อมใช้";
  };
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
  const sum = (list: { paid: number }[]) =>
    list.reduce((a, row) => a + row.paid, 0);
  const columns = company
    ? [...what, ...cost.slice(1), change]
    : [...what, ...where, ...cost];
  // A phone keeps the name and where it is; the company's, with no places, what it cost.
  const wideOnly = company
    ? ["SKU", "รายละเอียด / สเปก", "จำนวนซื้อ"]
    : ["SKU", "ประเภท", "รายละเอียด / สเปก", ...cost];
  const wide = (column: string) => wideOnly.includes(column) && "max-md:hidden";

  return (
    <div className="flex flex-col gap-4">
      <Panel
        className={figureGrid}
        aria-label={`สรุปสินทรัพย์ของ${company ? owner : " Project"}`}
      >
        <Stat
          label={`มูลค่าที่ซื้อเข้า ${owner}`}
          value={baht(sum([...bought.values()]))}
          note="ยอดจ่ายจริงจากหน้า Accounting · ไม่รวมที่ยกเลิก"
        />
        <Stat
          label={company ? "จำนวนรายการ" : "สินทรัพย์"}
          value={`${qty(bought.size)} รายการ`}
          note={`${qty(assets.length)} ประเภท`}
        />
        {!company && (
          // The page's jot button (the shell draws none here): a tile of the row, so it is
          // as easy to find as the figures.
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
        )}
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
        {!company && (
          <>
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
                options={[
                  all,
                  ...[...heads, transit].map((value) => ({ value })),
                ]}
              />
            </TableFilter>
          </>
        )}
      </div>
      <DayCard
        aria-label="รายการทั้งหมด"
        title="รายการทั้งหมด"
        // Up to fourteen columns: tighter cells, and a light rule between them.
        className="md:[&_:is(td,th)]:px-2 [&_:is(td,th)+:is(td,th)]:border-l"
        aside={
          <Caption aria-live="polite">
            แสดง {shown.length} จาก {rows.length} รายการ
          </Caption>
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
          {shown.map((row) => {
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
                {!company && (
                  <>
                    {line ? <Left n={row.held[heads[0]]} /> : blank}
                    {counted.map((name) =>
                      // A material: what the branch counted. Anything else: its balance.
                      row.at ? (
                        <HeldCell
                          key={name}
                          held={row.at[name]}
                          today={today}
                          varianceUnit="ชิ้น"
                        />
                      ) : line ? (
                        <Left key={name} n={row.held[name]} />
                      ) : (
                        <Cell key={name} right>
                          {none}
                        </Cell>
                      ),
                    )}
                    <Transit n={row.held[transit]} />
                    {row.at ? (
                      <StatusCells
                        at={row.at}
                        places={counted}
                        extra={row.held[heads[0]] + row.held[transit]}
                        // Its long line may break: the table has fourteen columns.
                        className="md:min-w-24 md:whitespace-normal"
                      />
                    ) : (
                      <>
                        {line ? (
                          <Left
                            n={Object.values(row.held).reduce(
                              (a, n) => a + n,
                              0,
                            )}
                          />
                        ) : (
                          blank
                        )}
                        <Cell>{none}</Cell>
                      </>
                    )}
                  </>
                )}
                {!company && (
                  <Cell className="min-w-24 max-md:hidden">
                    {row.vendor || none}
                  </Cell>
                )}
                <Cell className={cn("whitespace-nowrap", wide("ซื้อล่าสุด"))}>
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
                {company && row.entry && (
                  <Cell className="px-2 whitespace-nowrap">
                    <span className="flex gap-1">
                      {!editBlock(db, row.entry, account) && (
                        <IconButton
                          label="แก้ไข"
                          icon={<Pencil size={16} />}
                          onClick={() => ws.edit(row.entry!.id)}
                        />
                      )}
                      {!voidBlock(db, row.entry, account) && (
                        <IconButton
                          label="ลบ"
                          icon={<Trash2 size={16} />}
                          className="text-danger"
                          onClick={() => remove(row.entry!)}
                        />
                      )}
                    </span>
                  </Cell>
                )}
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
                  ? "ไม่พบรายการที่ตรงกับที่ค้นหา"
                  : `ยังไม่มีของที่ซื้อเข้า${owner} · จดที่หน้า Accounting เลือกใช้เพื่องาน「${owner}」`}
              </Cell>
            </tr>
          )}
        </StockTable>
      </DayCard>
      <Caption>
        {company
          ? `ของที่ซื้อจากหน้า Accounting โดยเลือกใช้เพื่องาน「${owner}」 รายการเดียวกันรวมทุกครั้งที่ซื้อ ไม่รวมที่ยกเลิก`
          : "แถวละรายการ: วัสดุจาก Settings และของที่ซื้อเข้า Project จากหน้า Accounting รวมทุกครั้งที่ซื้อ · คลังกลาง = ซื้อเข้า − จัดสรรออก ไม่มีการนับ · ระหว่างส่ง = ส่งแล้ว รอสาขากดยืนยันรับ · รวม นับของระหว่างส่งด้วย · ตัวเลขสีแดง = ติดลบ · ยอดวัสดุของสาขาคือยอดที่แอดมินสาขานับ (ชิ้น) ช่องสีเหลือง = ยังไม่เคยนับ หรือไม่ได้นับเกิน 7 วัน ช่องสีแดง = ไม่เหลือ · ส่วนต่าง = นับได้ − ควรเหลือ ของการนับครั้งล่าสุด · เนื้อ ข้าวเหนียว และน้ำพริกอยู่ที่หน้า Stock"}
      </Caption>
    </div>
  );
}

/** The central company's Inventory (`/owner/inventory`). */
export const CompanyStock = ({ ws }: { ws: Workspace }) => (
  <OwnerStock ws={ws} company />
);
