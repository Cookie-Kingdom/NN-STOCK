"use client";

import { useState } from "react";
import { MissingMark } from "@/components/atoms/MissingMark";
import { NoteDetail } from "@/components/organisms/shared/NoteRow";
import {
  lotLabel,
  noteAmount,
  noteLine,
  noteSub,
  noteTags,
  timeOf,
} from "@/components/organisms/shared/noteText";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { noBranch, titles, type Entry } from "@/lib/store";
import { cn } from "@/lib/utils";

/* A cell: in a column at `@3xl` of the container and wider; under it the table is a list and
 * a row a small grid (time, the note, its figure), like `NoteRow`. */
const cell = "p-0 @3xl:px-3 @3xl:py-2.5 @3xl:align-baseline @3xl:first:pl-5";
const figure =
  "text-right font-semibold whitespace-nowrap tabular-nums @max-3xl:col-start-3 @max-3xl:row-start-1 @max-3xl:empty:hidden";

const heads = (own: boolean) => [
  "เวลา",
  "รายการ",
  own ? "PO / Lot" : "สาขา · PO / Lot",
  "รายละเอียด",
  "จำนวน",
  "เงิน (บาท)",
];

/** The widths of the columns: the same in every day's table and in the head above the days,
 *  so a column runs straight down the page. */
const Cols = ({ own }: { own: boolean }) => (
  <colgroup>
    <col className="w-15" />
    <col className="w-37" />
    <col className={own ? "w-28" : "w-30"} />
    <col />
    <col className="w-21" />
    <col className="w-26" />
  </colgroup>
);

/** The names of the columns, once above every day's table; not there when the tables are
 *  lists. Each table names its own columns for a screen reader, so this one is hidden from it. */
export function NoteTableHead({ own }: { own: boolean }) {
  return (
    <table
      aria-hidden
      // The transparent border is a day card's: the columns start where a card's do.
      className="sticky top-0 z-10 w-full table-fixed border border-transparent bg-bg text-caption font-semibold text-text-secondary @max-3xl:hidden"
    >
      <Cols own={own} />
      <tbody>
        <tr>
          {heads(own).map((name, i, all) => (
            <td
              key={name}
              className={cn(
                "px-3 py-1.5 first:pl-5",
                i >= all.length - 2 && "text-right",
                i === all.length - 1 && "pr-5",
              )}
            >
              {name}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** The notes of one day as a table, one note a row: when it was jotted, what it is, its
 *  branch and its PO or Lot, what was jotted, and its figure, a weight or a count in one column
 *  and baht in the next (green with a plus is money in, red with a minus money out). Pressing
 *  a row opens every value of the note under it. A note with something not jotted is yellow. */
export function NoteTable({ rows, ws }: { rows: Entry[]; ws: Workspace }) {
  const own = ws.account.role === "branch";
  return (
    <table className="w-full table-fixed border-collapse text-body-sm @max-3xl:block">
      <Cols own={own} />
      <thead className="sr-only">
        <tr>
          {heads(own).map((name) => (
            <th key={name} scope="col">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      {rows.map((e) => (
        <Row key={e.id} entry={e} ws={ws} span={heads(own).length} />
      ))}
    </table>
  );
}

function Row({
  entry: e,
  ws,
  span,
}: {
  entry: Entry;
  ws: Workspace;
  span: number;
}) {
  const [open, setOpen] = useState(false);
  const { db, account } = ws;
  const own = account.role === "branch";
  const tags = noteTags(db, e, account);
  const flagged = tags.length > 0;
  const amount = noteAmount(db, e);
  // Baht in its own column, so money adds up down the page and never sits under a weight.
  const money = amount?.text.includes("฿");
  const line = noteLine(db, e);
  const sub = noteSub(db, e, account);
  return (
    <tbody
      data-entry={e.id}
      data-kind={e.kind}
      data-tone={flagged ? "warning" : undefined}
      className={cn(
        "border-b border-border last:border-b-0 @max-3xl:block",
        flagged ? "bg-warning-subtle" : open && "bg-surface-sunken",
      )}
    >
      <tr
        onClick={() => setOpen(!open)}
        className={cn(
          "group cursor-pointer @max-3xl:grid @max-3xl:grid-cols-[44px_minmax(0,1fr)_auto] @max-3xl:items-baseline @max-3xl:gap-x-2 @max-3xl:px-4 @max-3xl:py-3",
          !flagged && "hover:bg-surface-sunken",
        )}
      >
        <td
          className={cn(
            cell,
            "text-caption text-text-secondary tabular-nums @max-3xl:row-span-2",
          )}
        >
          {timeOf(e.at)}
        </td>
        <td className={cn(cell, "@max-3xl:col-start-2")}>
          {/* The row's one control: a press anywhere on the row reaches the row through it. */}
          <button
            type="button"
            aria-expanded={open}
            className="cursor-pointer text-left font-semibold transition-colors duration-(--motion-fast) ease-(--ease-standard) group-hover:text-accent"
          >
            {titles[e.kind]}
          </button>
        </td>
        {/* One column for where a note belongs: few notes have both a branch and a lot. */}
        <td className={cn(cell, "@max-3xl:hidden")}>
          {!own && (e.branch || (e.role === "branch" && noBranch))}
          {e.lotId && (
            <span className="block text-caption whitespace-nowrap text-text-secondary">
              {lotLabel(db, e.lotId)}
            </span>
          )}
        </td>
        <td
          className={cn(
            cell,
            "[overflow-wrap:anywhere] text-text-secondary @max-3xl:col-span-2 @max-3xl:col-start-2 @max-3xl:row-start-2",
          )}
        >
          {line}
          {sub && <span className="block text-caption @3xl:hidden">{sub}</span>}
          {flagged && (
            <span className={cn("flex flex-wrap gap-1", line && "mt-1")}>
              {tags.map((tag) => (
                <MissingMark key={tag}>{tag}</MissingMark>
              ))}
            </span>
          )}
        </td>
        <td className={cn(cell, figure)}>{!money && amount?.text}</td>
        <td
          className={cn(
            cell,
            figure,
            "@3xl:pr-5",
            amount?.tone === "in" && "text-success",
            amount?.tone === "out" && "text-danger",
          )}
        >
          {money && amount?.text}
        </td>
      </tr>
      {open && (
        <tr className="@max-3xl:block">
          <td colSpan={span} className="p-0 @max-3xl:block">
            <NoteDetail
              entry={e}
              ws={ws}
              className="px-4 pt-1 pb-5 @3xl:pr-5 @3xl:pl-20"
            />
          </td>
        </tr>
      )}
    </tbody>
  );
}
