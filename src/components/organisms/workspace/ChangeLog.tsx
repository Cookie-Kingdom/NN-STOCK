"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Panel } from "@/components/atoms/Panel";
import { ReadRow } from "@/components/atoms/ReadRow";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { EmptyState } from "@/components/molecules/EmptyState";
import { FormError } from "@/components/molecules/FormError";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import {
  EditDiff,
  changeOf,
  entryWho,
  voidWords,
} from "@/components/organisms/shared/EntryDetails";
import { referenceText } from "@/components/organisms/shared/entryReferences";
import { today } from "@/lib/format";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import {
  changeKinds,
  check,
  isVoided,
  mutate,
  visibleEntries,
  voidBlock,
  type ActingRole,
  type Database,
  type Entry,
} from "@/lib/store";

const at = (iso: string) => new Date(iso).toLocaleString("th-TH");
/** Rows shown before "ดูทั้งหมด". */
const newest = 30;

function ChangeRow({
  change: e,
  db,
  role,
  branch,
  onChanged,
}: {
  change: Entry;
  db: Database;
  role: ActingRole;
  branch: string;
  onChanged: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const { title, name } = changeOf(db, e);
  // No confirm step: an undo is itself undone by making the change again.
  const undo = () => {
    setError("");
    const words = voidWords(e.kind);
    let next = undefined as Database | undefined;
    // A stock left below zero is only a warning: it is said with the result, and saved.
    const { warnings, error } = check(() => {
      next = mutate(
        latestDatabase(),
        role,
        "void",
        { targetId: e.id, reason: "ย้อนกลับ" },
        "",
        today(),
        branch,
      );
    });
    if (!next) return setError(error || words.fail);
    saveDatabase(next);
    onChanged([words.done, ...warnings].join(" · "));
  };
  return (
    <div className="border-b border-border py-3.5 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-body-sm">
          {[title, name].filter(Boolean).join(" · ")}
        </strong>
        {isVoided(db, e.id) && <Badge>ย้อนกลับแล้ว</Badge>}
      </div>
      <ReadRow label="ผู้ทำรายการ" value={`${entryWho(e)} · ${at(e.at)}`} />
      <ReadRow label="เหตุผล" value={e.values.reason || "–"} />
      {e.kind === "entryEdit" && <EditDiff values={e.values} db={db} />}
      {e.kind === "link" && (
        <ReadRow
          label="ผูกกับ"
          value={referenceText(db, "lotId", e.values.lotId)}
        />
      )}
      {!voidBlock(db, e, role, branch) && (
        <ButtonRow compact>
          <Button onClick={undo}>ย้อนกลับ</Button>
        </ButtonRow>
      )}
      <FormError error={error} />
    </div>
  );
}

/** EDT-25, the undo stack: every edit, delete and link `role` may see, newest first, each
 *  with what it changed and a one-press undo. The Owner reads back every account's changes; a
 *  branch its own and the Owner's changes to its entries (`visibleEntries`). `db` is the whole
 *  log the account holds. */
export function ChangeLog({
  db,
  role,
  branch,
  onChanged,
}: {
  db: Database;
  role: ActingRole;
  branch: string;
  onChanged: (message: string) => void;
}) {
  const [all, setAll] = useState(false);
  const changes = visibleEntries(db, role, branch)
    .filter((e) => changeKinds.includes(e.kind))
    .reverse();
  return (
    <Panel>
      <SectionHeading
        title="ประวัติการแก้ไขและลบ"
        description="ทุกการแก้ไขและลบเก็บไว้ที่นี่ · กดย้อนกลับเพื่อคืนค่าเดิมหรือกู้คืนรายการที่ลบ"
      />
      {changes.length ? (
        (all ? changes : changes.slice(0, newest)).map((change) => (
          <ChangeRow
            key={change.id}
            change={change}
            db={db}
            role={role}
            branch={branch}
            onChanged={onChanged}
          />
        ))
      ) : (
        <EmptyState text="ยังไม่มีการแก้ไขหรือลบ" />
      )}
      {changes.length > newest && (
        <ButtonRow compact>
          <Button onClick={() => setAll(!all)}>
            {all ? `ดู ${newest} รายการล่าสุด` : "ดูทั้งหมด"}
          </Button>
        </ButtonRow>
      )}
    </Panel>
  );
}
