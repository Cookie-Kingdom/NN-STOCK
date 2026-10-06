"use client";

import { useState } from "react";
import { Building2, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Input } from "@/components/atoms/Input";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Stat } from "@/components/atoms/Stat";
import { Caption, Muted } from "@/components/atoms/Text";
import { AttachmentButton } from "@/components/molecules/AttachmentButton";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Notice } from "@/components/molecules/Notice";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { TableFilter } from "@/components/molecules/TableFilter";
import { td, tf, th } from "@/components/organisms/shared/tableCell";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, dateLabel, qty } from "@/lib/format";
import {
  editBlock,
  ledgerPurposes,
  ledgerRows,
  ledgerSources,
  ledgerStatuses,
  ledgerSummary,
  voidBlock,
  type LedgerRow,
  type LedgerStatus,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { figureGrid } from "./PlTable";
import { Num } from "./PlTable";

const statusTone: Record<LedgerStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  paid: "success",
  cancelled: "danger",
};
const columns = [
  "วันที่",
  "ที่มา / ประเภทบิล",
  "เลขที่อ้างอิง (PO / ใบเสร็จ)",
  "ประเภทสินค้า",
  "รายการ",
  "รายละเอียด / สเปก",
  "ผู้ขาย / ร้านค้า",
  "ค่าใช้จ่ายของ",
  "Project",
];
const figures = ["จำนวนซื้อ", "ยอดตาม PO (งบที่กันไว้)", "ยอดจ่ายจริง"];
const none = <Muted as="span">—</Muted>;
const isWebLink = (value = "") => /^https?:\/\/\S+$/i.test(value);
const central = "ส่วนกลาง";
/** A row's Project as the table and the Project filter name it. */
const projectOf = (row: LedgerRow) =>
  row.purpose === "project" ? row.project : central;
/** A row's ที่มา as the filter names it: a row worked out from the log by its source. */
const sourceOf = (row: LedgerRow) =>
  row.source === "po" || row.source === "finance" ? row.source : "manual";

/** The shop's purchase ledger: every PO เนื้อ and PO รมควัน (worked out from the PO, its
 *  invoice and the payments to its supplier), every other money-out line of Finance (view
 *  only, as a PO row) and every expense jotted by hand, newest first,
 *  under the two figures worked out from it (what the POs still to pay hold, what was paid
 *  this month), with a search, a filter by project, status and source, and the totals of
 *  what is shown. */
export function AccountingPage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const { remove } = useEntryActions(ws);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [project, setProject] = useState("");
  const [search, setSearch] = useState("");
  const all = ledgerRows(db);
  const word = search.trim().toLowerCase();
  const rows = all.filter(
    (row) =>
      (!status || row.status === status) &&
      (!source || sourceOf(row) === source) &&
      (!project || projectOf(row) === project) &&
      (!word ||
        [row.item, row.detail, row.vendor, row.reference, row.sku].some(
          (text) => text.toLowerCase().includes(word),
        )),
  );
  // A long ledger draws its first rows; the totals below still count every row found.
  const { limit, more } = useShowMore(
    [status, source, project, word].join("|"),
  );
  const projects = [...new Set(all.map(projectOf).filter(Boolean))];
  const summary = ledgerSummary(all, today.slice(0, 7));
  const change = summary.paidBefore
    ? ((summary.paid - summary.paidBefore) / summary.paidBefore) * 100
    : null;
  // The quick filter: the POs still to pay, in one click; a second click clears it.
  const poPending = source === "po" && status === "pending";
  // A cancelled row holds no money.
  const counted = rows.filter((row) => row.status !== "cancelled");
  const total = (key: "poAmount" | "paid") =>
    counted.reduce((a, row) => a + (row[key] ?? 0), 0);

  if (!all.length)
    return (
      <EmptyState text='ยังไม่มีรายการซื้อ PO เนื้อและ PO รมควันจากหน้า Lots จะอยู่ที่นี่ ส่วนค่าใช้จ่ายอื่นจดได้จากปุ่ม "บันทึกค่าใช้จ่าย"' />
    );

  const cell = (row: LedgerRow) => {
    const e = row.entry;
    const item = row.item ? (
      <>
        <span className="block">{row.item}</span>
        {row.sku && <Caption as="span">{row.sku}</Caption>}
      </>
    ) : (
      <MissingMark />
    );
    const Purpose = row.purpose === "project" ? FolderKanban : Building2;
    return (
      <tr key={row.id} data-source={row.source}>
        <td className={cn(td, "whitespace-nowrap")}>{dateLabel(row.date)}</td>
        <td className={cn(td, "whitespace-nowrap")}>
          {row.sourceLabel || none}
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {row.lotId ? (
            <Button variant="link" onClick={() => ws.showLot(row.lotId!)}>
              {row.reference}
            </Button>
          ) : (
            row.reference || none
          )}
        </td>
        <td className={td}>{row.itemType || <MissingMark />}</td>
        <td className={cn(td, "min-w-36")}>{item}</td>
        <td className={cn(td, "min-w-36")}>{row.detail || none}</td>
        <td className={td}>{row.vendor || none}</td>
        <td className={cn(td, "whitespace-nowrap")}>
          <span className="inline-flex items-center gap-1.5">
            <Purpose size={16} aria-hidden className="text-text-secondary" />
            {ledgerPurposes[row.purpose]}
          </span>
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {row.purpose === "project" ? (
            row.project || <MissingMark />
          ) : (
            <Muted as="span">{central}</Muted>
          )}
        </td>
        <Num>
          {row.qty === null
            ? none
            : `${qty(row.qty)}${row.unit && ` ${row.unit}`}`}
        </Num>
        <Num>{row.poAmount === null ? none : baht(row.poAmount)}</Num>
        <Num>{row.paid === null ? none : baht(row.paid)}</Num>
        <td className={td}>
          <Badge tone={statusTone[row.status]}>
            {ledgerStatuses[row.status]}
          </Badge>
        </td>
        <td className={cn(td, "whitespace-nowrap")}>
          {row.lotId ? (
            <Button variant="table" onClick={() => ws.showLot(row.lotId!)}>
              เปิด PO
            </Button>
          ) : row.source === "finance" ? (
            <Button variant="table" onClick={() => ws.setTab("finance")}>
              เปิด Finance
            </Button>
          ) : e?.values.attachment || isWebLink(e?.values.link) ? (
            <div className="flex flex-col items-start gap-1">
              {e?.values.attachment && (
                <AttachmentButton
                  action="view"
                  name={e.values.attachment}
                  data={e.values.attachmentData}
                  storageKey={e.values.attachmentStorageKey}
                />
              )}
              {isWebLink(e?.values.link) && (
                <a
                  href={e!.values.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-body-sm text-accent underline-offset-4 hover:underline pointer-coarse:min-h-11"
                >
                  เปิดลิงก์
                </a>
              )}
            </div>
          ) : (
            none
          )}
        </td>
        <td className={cn(td, "px-2 whitespace-nowrap")}>
          {e && (
            <span className="flex gap-1">
              {!editBlock(db, e, account) && (
                <IconButton
                  label="แก้ไข"
                  icon={<Pencil size={16} />}
                  onClick={() => ws.edit(e.id)}
                />
              )}
              {!voidBlock(db, e, account) && (
                <IconButton
                  label="ลบ"
                  icon={<Trash2 size={16} />}
                  className="text-danger"
                  onClick={() => remove(e)}
                />
              )}
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Notice className="my-0 text-body-sm">
        PO เนื้อและ PO รมควันจากหน้า Lots อยู่ในตารางนี้เป็นรายการรอจ่าย
        ยอดจ่ายจริงคิดจากรายการจ่ายเงินให้ผู้ขาย รายการจ่ายเงินอื่นจากหน้า
        Finance ขึ้นเองเป็นแถวจ่ายแล้ว
      </Notice>
      <Panel className={figureGrid} aria-label="สรุปรายการซื้อ">
        <Stat
          label="งบที่กันไว้จาก PO"
          value={baht(summary.reserved)}
          note={`${summary.waiting} รายการที่ยังรอจ่าย`}
        />
        <Stat
          label="ยอดจ่ายจริงเดือนนี้"
          value={baht(summary.paid)}
          note={
            change === null
              ? "เดือนก่อนไม่มียอดจ่าย"
              : change
                ? `${change > 0 ? "มากกว่า" : "น้อยกว่า"}เดือนก่อน ${qty(Math.round(Math.abs(change) * 10) / 10)}%`
                : "เท่ากับเดือนก่อน"
          }
        />
      </Panel>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Input
          type="search"
          variant="filter"
          aria-label="ค้นหา"
          placeholder="ค้นหารายการ ผู้ขาย เลข PO หรือ SKU"
          className="min-w-64 flex-1 max-md:basis-full"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TableFilter label="Project">
          <Select
            variant="filter"
            value={project}
            onChange={setProject}
            options={[
              { value: "", label: "ทั้งหมด" },
              ...projects.map((name) => ({ value: name })),
            ]}
          />
        </TableFilter>
        <TableFilter label="สถานะ">
          <Select
            variant="filter"
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "ทั้งหมด" },
              ...Object.entries(ledgerStatuses).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </TableFilter>
        <TableFilter label="ที่มา">
          <Select
            variant="filter"
            value={source}
            onChange={setSource}
            options={[
              { value: "", label: "ทั้งหมด" },
              { value: "po", label: ledgerSources.po },
              { value: "finance", label: ledgerSources.finance },
              { value: "manual", label: "ค่าใช้จ่ายอื่น" },
            ]}
          />
        </TableFilter>
        <Button
          size="sm"
          aria-pressed={poPending}
          className="min-h-10 aria-pressed:border-accent aria-pressed:text-accent"
          onClick={() => {
            setSource(poPending ? "" : "po");
            setStatus(poPending ? "" : "pending");
          }}
        >
          PO รอจ่าย ({summary.waiting})
        </Button>
      </div>
      <Panel flush className="overflow-hidden">
        {/* relative: the sr-only head of the last column scrolls with the table, not the page. */}
        <div className="relative overflow-x-auto">
          <table
            // The ledger's grid: a line between columns, and the row under the pointer;
            // narrower cells than the other tables, so more of its columns fit.
            className="w-full border-collapse [&_tbody_tr:hover]:bg-surface-sunken [&_td]:border-r [&_td]:px-3 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:px-3 [&_th:last-child]:border-r-0"
            aria-label="บัญชีรายการซื้อ"
          >
            <thead>
              <tr>
                {columns.map((name) => (
                  <th key={name} className={th}>
                    {name}
                  </th>
                ))}
                {figures.map((name) => (
                  <th key={name} className={cn(th, "text-right")}>
                    {name}
                  </th>
                ))}
                <th className={th}>สถานะ</th>
                <th className={th}>เอกสารแนบ</th>
                <th className={th}>
                  <span className="sr-only">แก้ไข / ลบ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(cell)}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={columns.length + figures.length + 3}
                    className={cn(td, "text-text-secondary")}
                  >
                    ไม่มีรายการตามตัวกรอง
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={columns.length + 1} className={cn(td, tf)}>
                    รวม {counted.length} รายการ
                    {counted.length < rows.length && (
                      <Caption as="span"> (ไม่รวมที่ยกเลิก)</Caption>
                    )}
                  </td>
                  <Num className={tf}>{baht(total("poAmount"))}</Num>
                  <Num className={tf}>{baht(total("paid"))}</Num>
                  <td colSpan={3} className={cn(td, tf)} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <ShowMore
          shown={Math.min(limit, rows.length)}
          total={rows.length}
          onMore={more}
        />
      </Panel>
      <Caption aria-live="polite">
        {rows.length} จาก {all.length} รายการ
      </Caption>
    </div>
  );
}
