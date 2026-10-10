"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { DatePicker } from "@/components/atoms/DatePicker";
import { Panel } from "@/components/atoms/Panel";
import { ReadRow } from "@/components/atoms/ReadRow";
import { Caption, Muted } from "@/components/atoms/Text";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { TableFilter } from "@/components/molecules/TableFilter";
import { Num } from "@/components/organisms/owner/PlTable";
import { NoteValues } from "@/components/organisms/shared/NoteRow";
import {
  editDiff,
  entryWho,
  jottedAt,
  lotLabel,
  noteAmount,
  noteLine,
  noteSub,
  timeOf,
} from "@/components/organisms/shared/noteText";
import { td, th } from "@/components/organisms/shared/tableCell";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { dateLabel, thaiDay } from "@/lib/format";
import {
  editBlock,
  liveEntries,
  logRows,
  noBranch,
  titles,
  voidBlock,
  type LogGroup,
  type LogRow,
} from "@/lib/store";
import { cn } from "@/lib/utils";

/** Rows drawn before 「ดูเพิ่มเติม」. */
const firstRows = 50;
const none = <Muted as="span">—</Muted>;
/** What came after a row, said quietly beside its title. */
const laterText = {
  "": "",
  deleted: "ลบแล้ว",
  edited: "แก้ไขภายหลัง",
  undone: "ย้อนกลับแล้ว",
};
const tones = { in: "text-success", out: "text-danger" };

/** One row of the log, and under it once pressed: every value of the note as it read then,
 *  who saved it and when, and what the account may do. A note that is still there gets
 *  「แก้ไข」 and 「ลบ」 (`editBlock`, `voidBlock`), a change 「ย้อนกลับ」 (`voidBlock` of the
 *  change). From md up the row is the table's cells; below md it is one cell of two lines. */
function Row({
  row,
  ws,
  columns,
}: {
  row: LogRow;
  ws: Workspace;
  columns: number;
}) {
  const [open, setOpen] = useState(false);
  const { db, account } = ws;
  const { remove, undo } = useEntryActions(ws);
  const { entry: e, note, action } = row;
  const own = account.role === "branch";
  const title = titles[note.kind] || note.kind;
  const amount = noteAmount(db, note);
  const diff = action === "edit" ? editDiff(db, e, account) : [];
  const detail =
    action === "edit"
      ? diff.map(([label, text]) => `${label}: ${text}`).join(" · ")
      : noteLine(db, note);
  const later = laterText[row.later];
  // A note jotted for another day than the one it was saved on.
  const backdated = note.date !== row.day;
  const chevron = (
    <ChevronRight
      aria-hidden
      className={cn(
        "size-4 shrink-0 text-text-secondary transition-transform duration-(--motion-fast) ease-(--ease-standard)",
        open && "rotate-90",
      )}
    />
  );
  // The live note with its edits laid over: what the form and the confirm read.
  const live =
    action === "jot" ? liveEntries(db).find((x) => x.id === e.id) : undefined;
  const canEdit = live && !editBlock(db, live, account);
  const canDelete = live && !voidBlock(db, live, account);
  const canUndo = action !== "jot" && !voidBlock(db, e, account);
  const name = [title, dateLabel(note.date), lotLabel(db, note.lotId)]
    .filter(Boolean)
    .join(" · ");
  const hidden = "max-md:hidden";
  return (
    <>
      {/* The buttons inside name the row for the keyboard; their press reaches this onClick. */}
      <tr
        data-entry={e.id}
        data-kind={action === "jot" ? e.kind : undefined}
        data-action={action}
        onClick={() => setOpen(!open)}
        className={cn(
          "cursor-pointer transition-colors duration-(--motion-fast) ease-(--ease-standard) hover:bg-surface-sunken",
          open && "bg-surface-sunken",
        )}
      >
        <td className={cn(td, hidden, "whitespace-nowrap tabular-nums")}>
          <button
            type="button"
            aria-expanded={open}
            className="inline-flex cursor-pointer items-center gap-1.5 pointer-coarse:min-h-11"
          >
            {chevron}
            {jottedAt(e.at)}
          </button>
        </td>
        <td className={cn(td, hidden)}>
          <Badge className="py-0 font-medium">{row.label}</Badge>
        </td>
        <td className={cn(td, hidden, "whitespace-nowrap")}>
          <span className="font-semibold">{title}</span>
          {later && <Caption as="span"> · {later}</Caption>}
        </td>
        <td
          className={cn(
            td,
            hidden,
            "whitespace-nowrap",
            !backdated && "text-text-secondary",
          )}
        >
          {dateLabel(note.date)}
        </td>
        {!own && (
          <td className={cn(td, hidden, "whitespace-nowrap")}>
            {note.branch || (note.role === "branch" ? noBranch : none)}
          </td>
        )}
        <td className={cn(td, hidden, "whitespace-nowrap")}>
          {note.lotId ? lotLabel(db, note.lotId) : none}
        </td>
        {/* max-w-0: the cell takes the room that is left, and cuts its line there. */}
        <td
          className={cn(
            td,
            hidden,
            "w-full max-w-0 min-w-48 truncate text-text-secondary",
          )}
        >
          {detail}
        </td>
        <Num tone={amount?.tone} className={hidden}>
          {amount?.text}
        </Num>
        <td colSpan={columns} className={cn(td, "py-0 md:hidden")}>
          <button
            type="button"
            aria-expanded={open}
            className="grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 py-3 text-left"
          >
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-caption text-text-secondary tabular-nums">
                {timeOf(e.at)}
              </span>
              <Badge className="py-0 font-medium">{row.label}</Badge>
              <strong className="font-semibold">{title}</strong>
            </span>
            <span
              className={cn(
                "text-right font-semibold whitespace-nowrap tabular-nums",
                amount?.tone && tones[amount.tone],
              )}
            >
              {amount?.text}
            </span>
            <span className="col-span-2 mt-0.5 truncate text-caption text-text-secondary">
              {[
                backdated && `วันที่รายการ ${thaiDay(note.date)}`,
                later,
                noteSub(db, note, account),
                detail,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-surface-sunken">
          <td colSpan={columns} className={cn(td, "pt-1 pb-5")}>
            <div className="flex animate-fade-in flex-col gap-3">
              {diff.length > 0 && (
                <div>
                  {diff.map(([label, text]) => (
                    <ReadRow key={label} label={label} value={text} />
                  ))}
                </div>
              )}
              {Object.keys(note.values).length > 0 && (
                <NoteValues entry={note} ws={ws} />
              )}
              <Caption>
                {action === "jot" ? "จด" : row.label}โดย {entryWho(e)} ·{" "}
                {jottedAt(e.at)}
              </Caption>
              {(canEdit || canDelete || canUndo) && (
                // Not the row's press: a button here acts, it does not close the row.
                <div
                  className="flex flex-wrap gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  {canEdit && (
                    <Button
                      size="sm"
                      className="max-md:min-h-11"
                      onClick={() => ws.edit(e.id)}
                    >
                      แก้ไข
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="danger"
                      className="max-md:min-h-11"
                      onClick={() => live && remove(live)}
                    >
                      ลบ
                    </Button>
                  )}
                  {canUndo && (
                    <Button
                      size="sm"
                      className="max-md:min-h-11"
                      onClick={() =>
                        undo(
                          e.id,
                          action === "void"
                            ? `กู้คืนแล้ว: ${name}`
                            : `ย้อนกลับการแก้ไขแล้ว: ${name}`,
                        )
                      }
                    >
                      ย้อนกลับ
                    </Button>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Everything the account saved or may see saved, as one table, newest first by when it was
 *  saved (`logRows`): a note jotted, an edit, a delete and an undo are each a row, under a
 *  line for each day of saving. วันที่รายการ is the day the note is about, so one jotted for
 *  an earlier day reads as such. A page for looking: nothing here opens a new note, only a
 *  row its edit, delete or undo, and nothing here reminds (the bell does). The Owner filters
 *  by group, every account by the days of saving. */
export function DailyLog({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const [group, setGroup] = useState<LogGroup>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const own = account.role === "branch";
  const all = useMemo(() => logRows(db, account, group), [db, account, group]);
  const rows = all.filter(
    (row) => (!from || row.day >= from) && (!to || row.day <= to),
  );
  const { limit, more } = useShowMore(`${group}|${from}|${to}`, firstRows);
  // The rows drawn, under the day each was saved on.
  const days: [string, LogRow[]][] = [];
  for (const row of rows.slice(0, limit)) {
    const last = days.at(-1);
    if (last?.[0] === row.day) last[1].push(row);
    else days.push([row.day, [row]]);
  }
  const columns = own ? 7 : 8;
  const filtered = group !== "all" || !!from || !!to;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {!own && (
          <SegmentedChoice
            label="กรองบันทึก"
            value={group}
            onChange={setGroup}
            options={[
              { value: "all", label: "ทั้งหมด" },
              { value: "lot", label: "Lot" },
              { value: "money", label: "เงิน" },
              { value: "branch", label: "สาขา" },
            ]}
          />
        )}
        <TableFilter label="บันทึกตั้งแต่">
          <DatePicker
            variant="filter"
            title="บันทึกตั้งแต่"
            placeholder="วันแรก"
            value={from}
            onChange={setFrom}
            max={to || today}
            clearable
          />
        </TableFilter>
        <TableFilter label="ถึง">
          <DatePicker
            variant="filter"
            title="บันทึกถึง"
            placeholder="วันนี้"
            value={to}
            onChange={setTo}
            min={from}
            max={today}
            clearable
          />
        </TableFilter>
      </div>
      {rows.length ? (
        <Panel flush className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table
              aria-label="บันทึกทั้งหมด เรียงตามเวลาที่บันทึก"
              // Fixed below md: the one cell of a row is as wide as the table, and cuts its line.
              // A line between the columns from md up; below md a row is one cell.
              className="w-full border-collapse max-md:table-fixed md:[&_:is(td,th)+:is(td,th)]:border-l [&_td]:px-3 [&_th]:px-3"
            >
              <thead className="max-md:hidden">
                <tr>
                  {[
                    "บันทึกเมื่อ",
                    "การกระทำ",
                    "รายการ",
                    "วันที่รายการ",
                    ...(own ? [] : ["สาขา"]),
                    "PO / Lot",
                    "รายละเอียด",
                  ].map((name) => (
                    <th key={name} scope="col" className={th}>
                      {name}
                    </th>
                  ))}
                  <th scope="col" className={cn(th, "text-right")}>
                    จำนวนเงิน
                  </th>
                </tr>
              </thead>
              {days.map(([day, list]) => (
                <tbody key={day}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={columns}
                      className="border-y border-border bg-surface-head py-1.5 text-left text-caption font-semibold text-text-secondary"
                    >
                      {thaiDay(day, {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}
                      {day === today && " · วันนี้"}
                    </th>
                  </tr>
                  {list.map((row) => (
                    <Row
                      key={row.entry.id}
                      row={row}
                      ws={ws}
                      columns={columns}
                    />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <ShowMore
            shown={Math.min(limit, rows.length)}
            total={rows.length}
            onMore={more}
          />
        </Panel>
      ) : (
        <EmptyState
          text={
            filtered
              ? "ไม่มีบันทึกตามตัวกรอง"
              : "ยังไม่มีบันทึก เมื่อจด แก้ไข หรือลบบันทึก รายการจะขึ้นที่นี่ตามเวลาที่บันทึก"
          }
        />
      )}
      <Caption aria-live="polite">{rows.length} รายการ</Caption>
    </div>
  );
}
