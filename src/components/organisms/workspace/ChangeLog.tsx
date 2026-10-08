"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Panel } from "@/components/atoms/Panel";
import { ReadRow } from "@/components/atoms/ReadRow";
import { Caption } from "@/components/atoms/Text";
import { EmptyState } from "@/components/molecules/EmptyState";
import {
  entryWho,
  fieldLabel,
  fieldText,
  fieldsOf,
  jottedAt,
  lotLabel,
} from "@/components/organisms/shared/noteText";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { dateLabel } from "@/lib/format";
import {
  changeKinds,
  isVoided,
  titles,
  unpack,
  visibleEntries,
  voidBlock,
  type Database,
  type Entry,
  type EntryKind,
} from "@/lib/store";

/** Rows shown before 「ดูทั้งหมด」. */
const newest = 5;

/** What the delete of another change is called. */
const undoTitles: Partial<Record<EntryKind, string>> = {
  void: "กู้คืนรายการ",
  entryEdit: "ย้อนกลับการแก้ไข",
};

/** What a change (an edit, a delete) did, and the entry it is about by its title, date and
 *  lot, as far as `db` names them. An undo names the change it undoes, which names the entry. */
function changeOf(db: Database, e: Entry) {
  const find = (id = "") => db.entries.find((x) => x.id === id);
  const target = find(e.values.targetId);
  const targetKind = (e.values.targetKind || target?.kind) as EntryKind;
  const undo = e.kind === "void" ? undoTitles[targetKind] : undefined;
  const about = undo ? find(target?.values.targetId) : target;
  const kind = (undo ? target?.values.targetKind : targetKind) as EntryKind;
  const date = undo
    ? target?.values.targetDate
    : e.values.targetDate || target?.date;
  return {
    title: undo || titles[e.kind],
    name: [
      titles[kind] || kind,
      date && dateLabel(date),
      about?.lotId && lotLabel(db, about.lotId),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Before → after of an edit: only the values it changed, and where it moved the entry (its
 *  date, its lot). */
function EditDiff({ change, ws }: { change: Entry; ws: Workspace }) {
  const { db, account } = ws;
  const values = change.values;
  const from = unpack("from.", values),
    to = unpack("to.", values);
  const list = fieldsOf(db, values.targetKind as EntryKind, account);
  const shown = (key: string, value = "") =>
    value
      ? fieldText(
          db,
          list.find((f) => f.key === key),
          value,
        )
      : "–";
  const rows = [
    ...Object.keys(to)
      // Not the bookkeeping of the entry: its `missing` list, where a file is stored.
      .filter(
        (key) =>
          key !== "missing" &&
          !key.endsWith("StorageKey") &&
          (from[key] ?? "") !== to[key],
      )
      .map((key) => [
        fieldLabel(list, key),
        `${shown(key, from[key])} → ${shown(key, to[key])}`,
      ]),
    ...(values.toDate
      ? [
          [
            "วันที่",
            `${dateLabel(values.fromDate)} → ${dateLabel(values.toDate)}`,
          ],
        ]
      : []),
    ...(values.toLotId
      ? [
          [
            "PO รมควัน",
            `${values.fromLotId ? lotLabel(db, values.fromLotId) : "–"} → ${lotLabel(db, values.toLotId)}`,
          ],
        ]
      : []),
  ];
  return rows.map(([label, value]) => (
    <ReadRow key={label} label={label} value={value} />
  ));
}

/** The edits and deletes the account may see, newest first. */
export const changesOf = (db: Database, account: Workspace["account"]) =>
  visibleEntries(db, account)
    .filter((e) => changeKinds.includes(e.kind))
    .reverse();

/** Every edit and delete the account may see, newest first, each with what it changed and a
 *  one-press 「ย้อนกลับ」: of an edit it brings the old values back, of a delete the entry.
 *  The Daily Log draws it only once asked for (its button says `changesOf(...).length`). */
export function ChangeLog({ ws }: { ws: Workspace }) {
  const [all, setAll] = useState(false);
  const { db, account } = ws;
  const { undo } = useEntryActions(ws);
  const changes = changesOf(db, account);
  return (
    <Panel aria-label="ประวัติการแก้ไขและลบ">
      <h2 className="m-0 text-h3">ประวัติการแก้ไขและลบ</h2>
      <Caption className="mb-1 block">
        การแก้ไขและการลบทุกครั้งอยู่ในรายการนี้ กด &quot;ย้อนกลับ&quot;
        เพื่อคืนค่าเดิมหรือกู้คืนรายการที่ลบ
      </Caption>
      {changes.length ? (
        (all ? changes : changes.slice(0, newest)).map((change) => {
          const { title, name } = changeOf(db, change);
          return (
            <div
              key={change.id}
              data-entry={change.id}
              className="border-b border-border py-3 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-body-sm font-semibold">
                  {[title, name].filter(Boolean).join(" · ")}
                </strong>
                {isVoided(db, change.id) ? (
                  <Badge>ย้อนกลับแล้ว</Badge>
                ) : (
                  !voidBlock(db, change, account) && (
                    <Button
                      size="sm"
                      className="max-md:min-h-11"
                      onClick={() =>
                        undo(
                          change.id,
                          change.kind === "void"
                            ? `กู้คืนแล้ว: ${name}`
                            : `ย้อนกลับการแก้ไขแล้ว: ${name}`,
                        )
                      }
                    >
                      ย้อนกลับ
                    </Button>
                  )
                )}
              </div>
              <Caption>
                {entryWho(change)} · {jottedAt(change.at)}
              </Caption>
              {change.kind === "entryEdit" && (
                <EditDiff change={change} ws={ws} />
              )}
            </div>
          );
        })
      ) : (
        <EmptyState compact text="ยังไม่มีการแก้ไขหรือลบ" />
      )}
      {changes.length > newest && (
        <Button
          size="sm"
          className="mt-3 max-md:min-h-11"
          onClick={() => setAll(!all)}
        >
          {all
            ? `ดู ${newest} รายการล่าสุด`
            : `ดูทั้งหมด ${changes.length} รายการ`}
        </Button>
      )}
    </Panel>
  );
}
