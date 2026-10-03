"use client";

import { useState } from "react";
import { Building2, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Caption, Muted } from "@/components/atoms/Text";
import { AttachmentButton } from "@/components/molecules/AttachmentButton";
import { EmptyState } from "@/components/molecules/EmptyState";
import { TableFilter } from "@/components/molecules/TableFilter";
import { td, th } from "@/components/organisms/shared/tableCell";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, dateLabel, qty } from "@/lib/format";
import {
  editBlock,
  ledgerPurposes,
  ledgerRows,
  ledgerSources,
  ledgerStatuses,
  voidBlock,
  type LedgerRow,
  type LedgerStatus,
} from "@/lib/store";
import { cn } from "@/lib/utils";
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
  "ใช้เพื่องาน",
  "Project",
];
const figures = ["จำนวนซื้อ", "ยอดตาม PO (กันงบไว้)", "ยอดจ่ายจริง"];
const none = <Muted as="span">—</Muted>;
const isWebLink = (value = "") => /^https?:\/\/\S+$/i.test(value);

/** The shop's purchase ledger: every PO เนื้อ and PO รมควัน (worked out from the PO, its
 *  invoice and the payments to its supplier) and every expense jotted by hand, newest first,
 *  with a filter by status and by source and the totals of what is shown. */
export function AccountingPage({ ws }: { ws: Workspace }) {
  const { db, account } = ws;
  const { remove } = useEntryActions(ws);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const all = ledgerRows(db);
  const rows = all.filter(
    (row) =>
      (!status || row.status === status) &&
      (!source || (source === "po") === (row.source === "po")),
  );
  // A cancelled row holds no money.
  const counted = rows.filter((row) => row.status !== "cancelled");
  const total = (key: "poAmount" | "paid") =>
    counted.reduce((a, row) => a + (row[key] ?? 0), 0);

  if (!all.length)
    return (
      <EmptyState text="ยังไม่มีรายการซื้อ · PO เนื้อ และ PO รมควัน ขึ้นที่นี่เอง ค่าใช้จ่ายอื่นกด บันทึกค่าใช้จ่าย" />
    );

  const cell = (row: LedgerRow) => {
    const e = row.entry;
    const item = row.item ? (
      <>
        <span className="block">{row.item}</span>
        {row.itemNo && <Caption as="span">{row.itemNo}</Caption>}
      </>
    ) : (
      <MissingMark />
    );
    const Purpose = row.purpose === "project" ? FolderKanban : Building2;
    return (
      <tr key={row.id} data-source={row.source}>
        <td className={cn(td, "whitespace-nowrap")}>{dateLabel(row.date)}</td>
        <td className={cn(td, "whitespace-nowrap")}>
          {ledgerSources[row.source]}
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
            <Muted as="span">ส่วนกลาง</Muted>
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
                  className="text-body-sm text-accent underline-offset-4 hover:underline"
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
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        <TableFilter label="สถานะ">
          <Select
            variant="filter"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {Object.entries(ledgerStatuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </TableFilter>
        <TableFilter label="ที่มา">
          <Select
            variant="filter"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="">ทั้งหมด</option>
            <option value="po">{ledgerSources.po}</option>
            <option value="manual">บันทึกเอง</option>
          </Select>
        </TableFilter>
      </div>
      <Panel flush className="overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse"
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
              {rows.map(cell)}
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
                <tr className="bg-surface-sunken font-semibold">
                  <td
                    colSpan={columns.length + 1}
                    className={cn(td, "border-t border-b-0")}
                  >
                    รวม {counted.length} รายการ
                    {counted.length < rows.length && (
                      <Caption as="span"> (ไม่รวมที่ยกเลิก)</Caption>
                    )}
                  </td>
                  <Num className="border-t border-b-0">
                    {baht(total("poAmount"))}
                  </Num>
                  <Num className="border-t border-b-0">
                    {baht(total("paid"))}
                  </Num>
                  <td colSpan={3} className={cn(td, "border-t border-b-0")} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>
    </div>
  );
}
