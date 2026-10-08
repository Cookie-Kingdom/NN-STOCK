"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { MissingMark } from "@/components/atoms/MissingMark";
import { AttachmentButton } from "@/components/molecules/AttachmentButton";
import {
  addedKeys,
  entryWho,
  fieldLabel,
  fieldText,
  fieldsOf,
  isUnlinked,
  jottedAt,
  linesText,
  lotLabel,
  noteAmount,
  noteLine,
  noteTags,
  timeOf,
} from "@/components/organisms/shared/noteText";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import {
  dispatchLines,
  editBlock,
  isNoteKind,
  noBranch,
  skuName,
  titles,
  voidBlock,
  type Entry,
} from "@/lib/store";
import { thaiDay } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One note as a row. First line: when it was jotted, its title, its branch as a pill (not for
 *  a branch, which reads its own), its PO or Lot, and the amount at the right. Second line:
 *  the one-line summary, cut where the row ends, then its yellow tags. Pressing it opens every
 *  value of the note, with 「แก้ไข」 and 「ลบ」 for an account that may change it. A row with a
 *  tag is yellow. `entry` is a live note with its edits laid over
 *  (`visibleNotes`, `entries`). */
export function NoteRow({
  entry: e,
  ws,
  dated = false,
}: {
  entry: Entry;
  ws: Workspace;
  /** Also say the day, above the time: for a list that holds notes of several days. */
  dated?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { db, account } = ws;
  const { remove } = useEntryActions(ws);
  const tags = noteTags(db, e, account);
  const amount = noteAmount(db, e);
  const line = noteLine(db, e);
  const branch =
    account.role !== "branch" &&
    (e.branch ? `สาขา${e.branch}` : e.role === "branch" && noBranch);
  const flagged = tags.length > 0;
  return (
    <div
      data-entry={e.id}
      data-kind={e.kind}
      data-tone={flagged ? "warning" : undefined}
      className={cn(
        "border-b border-border last:border-b-0",
        flagged ? "bg-warning-subtle" : open && "bg-surface-sunken",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group grid w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-baseline gap-x-3 px-5 py-3.5 text-left -outline-offset-2 max-md:gap-x-2 max-md:px-4"
      >
        <span className="text-caption text-text-secondary">
          {dated && (
            <span className="block whitespace-nowrap">{thaiDay(e.date)}</span>
          )}
          {timeOf(e.at)}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="font-semibold transition-colors duration-(--motion-fast) ease-(--ease-standard) group-hover:text-accent">
              {titles[e.kind]}
            </strong>
            {branch && <Badge className="py-0 font-medium">{branch}</Badge>}
            {e.lotId && (
              <span className="text-caption text-text-secondary">
                {lotLabel(db, e.lotId)}
              </span>
            )}
          </span>
          {line && (
            // The whole line is in the opened note: here it is cut, not wrapped.
            <span className="mt-0.5 block truncate text-body-sm text-text-secondary">
              {line}
            </span>
          )}
          {flagged && (
            <span className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <MissingMark key={tag}>{tag}</MissingMark>
              ))}
            </span>
          )}
        </span>
        <span
          className={cn(
            "text-right font-semibold whitespace-nowrap",
            amount?.tone === "in" && "text-success",
            amount?.tone === "out" && "text-danger",
          )}
        >
          {amount?.text}
        </span>
      </button>
      {open && (
        <div className="flex animate-fade-in flex-col gap-3 px-5 pt-1 pb-5 max-md:px-4 md:pl-19">
          <NoteValues entry={e} ws={ws} />
          <p className="text-caption text-text-secondary">
            จดโดย {entryWho(e)} · {jottedAt(e.at)}
          </p>
          <div className="flex flex-wrap gap-2">
            {!editBlock(db, e, account) && (
              <Button
                size="sm"
                className="max-md:min-h-11"
                onClick={() => ws.edit(e.id)}
              >
                แก้ไข
              </Button>
            )}
            {!voidBlock(db, e, account) && (
              <Button
                size="sm"
                variant="danger"
                className="max-md:min-h-11"
                onClick={() => remove(e)}
              >
                ลบ
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Every value of a note as a definition list. An empty core field says ยังไม่ได้จด in
 *  yellow, any other empty field is left out. A retired kind lists its raw values. */
function NoteValues({ entry: e, ws }: { entry: Entry; ws: Workspace }) {
  const { db, account } = ws;
  const v = e.values;
  const list = fieldsOf(db, e.kind, account);
  const rows: [string, ReactNode][] = isNoteKind(e.kind)
    ? [
        ...list.flatMap((f): [string, ReactNode][] => {
          if (f.when && !f.when(v)) return [];
          const value = v[f.key] ?? "";
          const label = `${f.label}${f.unit && f.type !== "number" ? ` (${f.unit})` : ""}`;
          // Any line's PO: a dispatch saved with one PO (poLotId) reads as one line.
          if (f.type === "poLines")
            return [
              [
                label,
                isUnlinked(db, e) ? (
                  <MissingMark key="none">ยังไม่ได้เลือก</MissingMark>
                ) : (
                  linesText(db, dispatchLines(v))
                ),
              ],
            ];
          if (!value)
            return f.core ? [[label, <MissingMark key="none" />]] : [];
          if (f.type === "file")
            return [
              [
                label,
                <AttachmentButton
                  key="file"
                  action="view"
                  label={value}
                  name={value}
                  data={v[`${f.key}Data`]}
                  storageKey={v[`${f.key}StorageKey`]}
                />,
              ],
            ];
          // A ledger item: the name its SKU goes by now.
          if (e.kind === "expense" && f.key === "item")
            return [[label, skuName(db, v.sku, value)]];
          return [[label, fieldText(db, f, value)]];
        }),
        ...addedKeys
          .filter((key) => v[key])
          .map((key): [string, ReactNode] => [fieldLabel(list, key), v[key]]),
      ]
    : Object.entries(v).filter(([, value]) => value);
  return (
    <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-5 gap-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-caption text-text-secondary">{label}</dt>
          <dd className="m-0 [overflow-wrap:anywhere] whitespace-pre-line">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
