"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Caption } from "@/components/atoms/Text";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { EntryFieldControl } from "@/components/organisms/shared/EntryFieldControl";
import { lotLabel } from "@/components/organisms/shared/noteText";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type {
  Draft,
  Workspace,
} from "@/components/organisms/workspace/useWorkspace";
import { saveAttachment } from "@/lib/attachment-store";
import { defaults, fields } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  branches,
  kindInfo,
  lotInfo,
  missingKeys,
  missingText,
  mutate,
  noteKinds,
  payrollCategory,
  purchaseLots,
  shipments,
  titles,
  visibleNotes,
  type Actor,
  type Entry,
  type NoteKind,
  type Values,
} from "@/lib/store";

const groupNames = {
  lot: "Lot",
  money: "เงิน",
  extra: "จดเพิ่มได้",
  branch: "สาขา",
};
/** The sample's form grid: as many 180px columns as fit. */
const grid =
  "my-0 grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-4";

/** The kinds an account may jot (V2-ACC): a branch its own kinds and its payments, the
 *  Account Manager everything but a sale. `mutate` refuses the rest. */
const kindsFor = (by: Actor) =>
  noteKinds.filter((kind) =>
    by.role === "branch"
      ? kindInfo[kind].group === "branch" || kind === "pay"
      : !(by.hidesSales && kind === "sale"),
  );

/** The inline card under the page header where every note is jotted. With no kind it asks
 *  「จดอะไร」; with one it is that kind's form; with `editId` the same form on that entry. */
export function Composer({ ws }: { ws: Workspace }) {
  const { draft, db, account } = ws;
  const card = useRef<HTMLDivElement>(null);
  // Opened from a row or a todo far down the page: bring the card into view.
  useEffect(() => {
    if (draft) card.current?.scrollIntoView?.({ block: "nearest" });
  }, [draft]);
  if (!draft) return null;
  const target = draft.editId
    ? visibleNotes(db, account).find((e) => e.id === draft.editId)
    : undefined;
  const kind = target ? (target.kind as NoteKind) : draft.kind;
  // An entry deleted on another device while its edit was opening.
  if (draft.editId && !target) return null;
  return (
    <div ref={card} className="scroll-mt-20">
      <Panel flush>
        {kind ? (
          <NoteForm
            key={draft.seq}
            ws={ws}
            draft={draft}
            kind={kind}
            target={target}
          />
        ) : (
          <KindPicker ws={ws} />
        )}
      </Panel>
    </div>
  );
}

function KindPicker({ ws }: { ws: Workspace }) {
  const kinds = kindsFor(ws.account);
  const own = ws.account.role === "branch";
  return (
    <section aria-label="จดอะไร" className="flex flex-col gap-4 p-5 max-md:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-h3">จดอะไร</h2>
        <Button
          variant="link"
          className="min-h-11 px-2 text-label"
          onClick={ws.closeDraft}
        >
          ปิด
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        {(Object.keys(groupNames) as (keyof typeof groupNames)[])
          .filter((group) => kinds.some((k) => kindInfo[k].group === group))
          .map((group) => (
            <div
              key={group}
              role="group"
              aria-label={groupNames[group]}
              className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 max-md:grid-cols-1"
            >
              <span className="pt-2.5 text-caption text-text-secondary max-md:pt-0">
                {group === "branch" && !own ? "จดแทนสาขา" : groupNames[group]}
              </span>
              <div className="flex flex-wrap gap-2">
                {kinds
                  .filter((k) => kindInfo[k].group === group)
                  .map((k) => (
                    <Button
                      key={k}
                      className="text-label"
                      onClick={() => ws.jot({ kind: k })}
                    >
                      {titles[k]}
                    </Button>
                  ))}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

function NoteForm({
  ws,
  draft,
  kind,
  target,
}: {
  ws: Workspace;
  draft: Draft;
  kind: NoteKind;
  /** The entry being edited, with its earlier edits laid over. */
  target?: Entry;
}) {
  const { db, account, today } = ws;
  const info = kindInfo[kind];
  /* An edit is checked as a note by the account that recorded it (mutate's `recorder`), so
   * the form offers that account's choices: its categories, its branch. */
  const by: Actor = !target
    ? account
    : target.role === "branch" && !target.actor
      ? { role: "branch", branch: target.branch }
      : { role: "owner", hidesSales: target.actor === "manager" };
  // Newest first. A PO kind goes on a PO เนื้อ, the other lot kinds on a Lot รมควัน.
  const lots = (
    info.lot === "po" ? purchaseLots(db) : info.lot ? shipments(db) : []
  ).reverse();
  const [values, setValues] = useState<Values>(() =>
    target ? { ...target.values } : { ...defaults(kind), ...draft.values },
  );
  const [date, setDate] = useState(target?.date ?? draft.date ?? today);
  const [lotId, setLotId] = useState(
    () =>
      target?.lotId ??
      draft.lotId ??
      (info.lot === "optional"
        ? // The newest Lot with meat still in the central stock; a branch holds no such figure.
          account.role === "owner"
          ? (lots.find((lot) => lotInfo(db, lot.id).centralKg > 0)?.id ?? "")
          : ""
        : // A PO รมควัน opens a new Lot; the rest of a Lot's notes go on the newest one.
          kind === "smokeOrder"
          ? ""
          : (lots[0]?.id ?? "")),
  );
  const [branch, setBranch] = useState(
    target?.branch || draft.branch || branches[0],
  );
  const files = useRef<Record<string, File>>({});
  /** Storage keys of files already uploaded, so a second attempt does not upload again. */
  const uploaded = useRef<Record<string, string>>({});
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");

  const shown = fields(kind, db, by).filter((f) => !f.when || f.when(values));
  const main = shown.filter((f) => !f.more);
  const more = shown.filter((f) => f.more);
  // Open from the start when an edit has something under it; the user's toggle then stands.
  const [moreOpen] = useState(() => more.some((f) => values[f.key]));
  const set = (key: string, value: string) =>
    setValues((last) => ({ ...last, [key]: value }));
  const onFile = (key: string, file: File | null) => {
    delete uploaded.current[key];
    if (file) files.current[key] = file;
    else delete files.current[key];
    set(key, file?.name ?? "");
  };

  const save = async (again: boolean) => {
    setError("");
    const next = await run(async () => {
      const input: Values = { ...values };
      for (const [key, file] of Object.entries(files.current)) {
        input[key] = file.name;
        delete input[`${key}Data`];
        // A payroll receipt goes to its own folder: the Account Manager cannot read it.
        input[`${key}StorageKey`] = uploaded.current[key] ??=
          await saveAttachment(
            file,
            kind === "pay" && input.category === payrollCategory
              ? "payroll"
              : kind,
          );
      }
      const latest = latestDatabase();
      return target
        ? mutate(
            latest,
            account,
            "entryEdit",
            {
              targetId: target.id,
              values: JSON.stringify(input),
              toDate: date,
              toLotId: lotId,
            },
            "",
            today,
          )
        : mutate(
            latest,
            account,
            kind,
            // A branch kind jotted for a branch: the branch picked at the head of the form.
            info.group === "branch" ? { ...input, branch } : input,
            lotId,
            date,
          );
    });
    if (!next) return;
    const saved = target
      ? visibleNotes(next, account).find((e) => e.id === target.id)
      : next.entries.at(-1);
    const missing = saved ? missingKeys(saved.values).length : 0;
    ws.setToast(
      `${target ? "แก้แล้ว" : "จดแล้ว"}: ${titles[kind]}${missing ? ` · ${missingText} ${missing} ช่อง` : ""}`,
    );
    if (again)
      ws.jot({ kind, lotId: saved?.lotId, branch: saved?.branch || undefined });
    else ws.closeDraft();
  };

  return (
    <form
      aria-label="จดบันทึก"
      noValidate
      className="flex flex-col gap-4 p-5 max-md:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="m-0 text-h3">
          {target ? "แก้ไข: " : ""}
          {titles[kind]}
        </h2>
        {shown.some((f) => f.core) ? (
          <Badge
            tone="warning"
            className="rounded-md border border-warning/40 font-medium whitespace-normal"
          >
            ช่องสีเหลือง = {missingText} บันทึกได้และเติมทีหลังได้
          </Badge>
        ) : (
          <Caption>จดเพิ่มได้ ไม่มีช่องที่ขึ้นสีเหลือง</Caption>
        )}
      </div>
      <FormGrid className={grid}>
        <FormField label="วันที่">
          <Input
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        {info.lot && (
          <FormField label={info.lot === "po" ? "PO เนื้อ" : "Lot"}>
            <Select
              value={lotId}
              onChange={(event) => setLotId(event.target.value)}
            >
              {/* An edit moves a note to another lot; it neither opens a new Lot nor clears one. */}
              {info.lot === "batch" && !target && (
                <option value="">Lot ใหม่</option>
              )}
              {info.lot === "optional" && !target?.lotId && (
                <option value="">ไม่ระบุ Lot</option>
              )}
              {info.lot === "po" && !lots.length && (
                <option value="">ยังไม่มี PO เนื้อ</option>
              )}
              {lotId && !lots.some((lot) => lot.id === lotId) && (
                <option value={lotId}>{lotLabel(db, lotId)}</option>
              )}
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.poId}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {info.group === "branch" && account.role !== "branch" && (
          <FormField label="สาขา">
            {/* An entry's branch is fixed when it is saved. */}
            <Select
              value={branch}
              disabled={!!target}
              onChange={(event) => setBranch(event.target.value)}
            >
              {branches.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </FormField>
        )}
        {main.map((f, index) => (
          <EntryFieldControl
            key={f.key}
            field={f}
            autoFocus={index === 0}
            values={values}
            set={set}
            onFile={onFile}
            onFileError={setError}
          />
        ))}
      </FormGrid>
      {more.length > 0 && (
        <details className="group" open={moreOpen || undefined}>
          <summary className="w-fit items-center justify-start gap-1 text-label text-accent">
            จดเพิ่มได้ {more.length} ช่อง
            <ChevronDown
              size={16}
              aria-hidden
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <FormGrid className={`${grid} mt-2`}>
            {more.map((f) => (
              <EntryFieldControl
                key={f.key}
                field={f}
                values={values}
                set={set}
                onFile={onFile}
                onFileError={setError}
              />
            ))}
          </FormGrid>
        </details>
      )}
      <FormError error={error} className="my-0" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="submit" variant="primary" disabled={saving}>
          บันทึก
        </Button>
        {!target && (
          <Button disabled={saving} onClick={() => save(true)}>
            บันทึกและจดต่อ
          </Button>
        )}
        <Button
          variant="link"
          className="min-h-11 px-2"
          onClick={ws.closeDraft}
        >
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
