"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Caption } from "@/components/atoms/Text";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { EntryFieldControl } from "@/components/organisms/shared/EntryFieldControl";
import { lotLabel } from "@/components/organisms/shared/noteText";
import { PoDocumentDialog } from "@/components/organisms/shared/PoDocumentDialog";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type {
  Draft,
  Workspace,
} from "@/components/organisms/workspace/useWorkspace";
import { saveAttachment } from "@/lib/attachment-store";
import { qty } from "@/lib/format";
import { attachmentFolder, defaults, fields, type Field } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  branches,
  capacityWarning,
  defaultRound,
  dispatchLines,
  isRoundKind,
  kindInfo,
  lotInfo,
  missingKeys,
  missingText,
  mutate,
  poInfo,
  poTerms,
  prefillLineKg,
  purchaseLots,
  remainingKg,
  roundsOf,
  shipments,
  titles,
  visibleNotes,
  type Actor,
  type Database,
  type Entry,
  type NoteKind,
  type Values,
} from "@/lib/store";
import { cn } from "@/lib/utils";

/** The sample's form grid: as many 180px columns as fit. */
const grid =
  "my-0 grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-4";
/** A kg the web works out, as typed into a field: at most two decimals. */
const kgValue = (x: number) => String(Math.round(x * 100) / 100);

/** The inline card under the page header where a note is jotted: the form of `draft.kind`
 *  (opened by a page's jot buttons or a todo), or with `editId` the same form on that entry. */
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
  // No kind, or an entry deleted on another device while its edit was opening.
  if (!kind || (draft.editId && !target)) return null;
  // A PO เนื้อ / PO รมควัน is jotted as its document, in its own dialog.
  if (kind === "purchase" || kind === "smokeOrder")
    return (
      <PoDocumentDialog
        key={draft.seq}
        ws={ws}
        kind={kind}
        entryId={draft.editId}
        values={draft.values}
        date={draft.date}
        onClose={ws.closeDraft}
      />
    );
  return (
    <div ref={card} className="animate-fade-up scroll-mt-20">
      <Panel flush>
        <NoteForm
          key={draft.seq}
          ws={ws}
          draft={draft}
          kind={kind}
          target={target}
        />
      </Panel>
    </div>
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
  // Newest first. A PO kind goes on a PO เนื้อ, the other lot kinds on a PO รมควัน.
  const lots = (
    info.lot === "po" ? purchaseLots(db) : info.lot ? shipments(db) : []
  ).reverse();
  const [lotId, setLotId] = useState(
    () =>
      target?.lotId ??
      draft.lotId ??
      (info.lot === "optional"
        ? // The newest PO รมควัน with meat still in the central stock; a branch holds no such figure.
          account.role === "owner"
          ? (lots.find((lot) => lotInfo(db, lot.id).centralKg > 0)?.id ?? "")
          : ""
        : // The rest go on the newest one. purchase and smokeOrder open their own lot.
          (lots[0]?.id ?? "")),
  );
  /** What the web fills in for the lot picked: a dispatch the kg the PO รมควัน has left, a
   *  round step its round, a waste receipt the PO เนื้อ's waste kg. */
  const prefill = (lot: string): Values => {
    if (isRoundKind(kind))
      return { dispatchId: (lot && defaultRound(db, lot, kind)?.id) || "" };
    if (!lot) return {};
    if (kind === "dispatch") {
      const left = remainingKg(db, lot, target?.id);
      return left > 0 ? { dispatchKg: kgValue(left) } : {};
    }
    if (kind === "ownerWasteReceive") {
      const waste = poTerms(db, lot).wasteKg;
      return waste > 0 ? { receivedKg: kgValue(waste) } : {};
    }
    return {};
  };
  /** The keys the user (or the edited entry, or the todo) gave: a new lot leaves them be. */
  const typed = useRef(
    new Set(Object.keys(target?.values ?? draft.values ?? {})),
  );
  const [values, setValues] = useState<Values>(() => {
    if (!target)
      return {
        ...defaults(kind, db.config),
        ...prefill(lotId),
        ...draft.values,
      };
    const v = { ...target.values };
    // A dispatch saved with one PO เนื้อ (poLotId) opens as one line.
    if (kind === "dispatch" && !v.poLines && v.poLotId)
      v.poLines = JSON.stringify(dispatchLines(v));
    return v;
  });
  const pickLot = (next: string) => {
    setLotId(next);
    setValues((last) => {
      const v = { ...last };
      // A round belongs to its lot: always the new lot's.
      for (const [key, value] of Object.entries(prefill(next)))
        if (key === "dispatchId" || !typed.current.has(key)) v[key] = value;
      return v;
    });
  };
  const [date, setDate] = useState(target?.date ?? draft.date ?? today);
  const [branch, setBranch] = useState(
    target?.branch || draft.branch || branches[0],
  );
  const files = useRef<Record<string, File>>({});
  /** Storage keys of files already uploaded, so a second attempt does not upload again. */
  const uploaded = useRef<Record<string, string>>({});
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");

  const shown = fields(kind, db, by, lotId).filter(
    (f) => !f.when || f.when(values),
  );
  const main = shown.filter((f) => !f.more);
  const more = shown.filter((f) => f.more);
  // Open from the start when an edit has something under it; the user's toggle then stands.
  const [moreOpen] = useState(() => more.some((f) => values[f.key]));
  const set = (key: string, value: string) => {
    typed.current.add(key);
    setValues((last) => ({ ...last, [key]: value }));
  };
  const onFile = (key: string, file: File | null) => {
    delete uploaded.current[key];
    if (file) files.current[key] = file;
    else delete files.current[key];
    set(key, file?.name ?? "");
  };

  // A dispatch: what the PO รมควัน has room for, and whether its PO เนื้อ lines add up.
  const lines = kind === "dispatch" ? lineCheck(values) : undefined;
  const capacity =
    kind === "dispatch" && lotId && values.dispatchKg
      ? capacityWarning(db, lotId, Number(values.dispatchKg) || 0, target?.id)
      : "";
  const roundNote = roundText(db, kind, lotId, values);

  const save = async (again: boolean) => {
    setError("");
    const next = await run(async () => {
      const input: Values = { ...values };
      for (const [key, file] of Object.entries(files.current)) {
        input[key] = file.name;
        delete input[`${key}Data`];
        // A payroll receipt goes to its own folder: the Account Manager cannot read it.
        input[`${key}StorageKey`] = uploaded.current[key] ??=
          await saveAttachment(file, attachmentFolder(kind, input));
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
          <FormField label={info.lot === "po" ? "PO เนื้อ" : "PO รมควัน"}>
            <Select
              value={lotId}
              onChange={(event) => pickLot(event.target.value)}
            >
              {/* An edit moves a note to another lot; it never clears one. */}
              {info.lot === "optional" && !target?.lotId && (
                <option value="">ไม่ระบุ PO รมควัน</option>
              )}
              {info.lot !== "optional" && !lots.length && (
                <option value="">
                  ยังไม่มี {info.lot === "po" ? "PO เนื้อ" : "PO รมควัน"}
                </option>
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
        {main.map((f, index) =>
          f.type === "poLines" ? (
            <PoLinesControl
              key={f.key}
              field={f}
              db={db}
              values={values}
              set={set}
              exceptId={target?.id}
            />
          ) : (
            <EntryFieldControl
              key={f.key}
              field={f}
              autoFocus={index === 0}
              values={values}
              set={set}
              onFile={onFile}
              onFileError={setError}
            />
          ),
        )}
      </FormGrid>
      {capacity && (
        <Notice tone="warning" className="my-0 text-body-sm">
          {capacity}
        </Notice>
      )}
      {roundNote && (
        <p aria-live="polite" className="m-0 text-body-sm text-text-secondary">
          {roundNote}
        </p>
      )}
      {more.length > 0 && (
        <details className="group" open={moreOpen || undefined}>
          <summary className="w-fit items-center justify-start gap-1 text-label text-accent">
            จดเพิ่มได้ {more.length} ช่อง
            <ChevronDown
              size={16}
              aria-hidden
              className="transition-transform duration-(--motion-base) ease-(--ease-standard) group-open:rotate-180"
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
        <Button
          type="submit"
          variant="primary"
          disabled={saving || lines?.ok === false}
        >
          บันทึก
        </Button>
        {!target && (
          <Button
            disabled={saving || lines?.ok === false}
            onClick={() => save(true)}
          >
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

type Line = { poLotId: string; kg: string };
/** A `poLines` value as the form holds it: rows whose PO or kg may still be empty. */
function formLines(json = ""): Line[] {
  try {
    const rows: unknown = JSON.parse(json || "[]");
    if (Array.isArray(rows))
      return rows.map((row) => ({
        poLotId: String(row?.poLotId ?? ""),
        kg: String(row?.kg ?? ""),
      }));
  } catch {}
  return [];
}
/** A dispatch's PO เนื้อ lines against its dispatchKg: the status line, and whether it may be
 *  saved (every line has a PO and a kg, and they add up; `mutate` refuses the rest). An empty
 *  dispatchKg becomes the lines' total (mutate fills it in). */
function lineCheck(values: Values) {
  const rows = formLines(values.poLines);
  const total = rows.reduce((a, row) => a + (Number(row.kg) || 0), 0);
  const target = Number(values.dispatchKg) || 0;
  const left = target - total;
  const even = !target || Math.abs(left) < 0.005;
  return {
    ok:
      rows.length > 0 &&
      rows.every((row) => row.poLotId && row.kg.trim()) &&
      even,
    text: !rows.length
      ? "ยังไม่ได้เลือก PO เนื้อ"
      : !target
        ? `รวม ${qty(total)} กก.`
        : `รวม ${qty(total)} / ${qty(target)} กก. · ${even ? "ครบ" : left > 0 ? `ขาด ${qty(left)}` : `เกิน ${qty(-left)}`}`,
  };
}

/** A dispatch's PO เนื้อ lines: rows of [PO | kg | remove]. A PO picked fills its kg with what
 *  it still holds, up to what the dispatch still lacks (`prefillLineKg`); a PO is picked once. */
function PoLinesControl({
  field: f,
  db,
  values,
  set,
  exceptId,
}: {
  field: Field;
  db: Database;
  values: Values;
  set: (key: string, value: string) => void;
  /** The dispatch being edited: its own lines do not count against a PO. */
  exceptId?: string;
}) {
  const rows = formLines(values[f.key]);
  const write = (next: Line[]) =>
    set(f.key, next.length ? JSON.stringify(next) : "");
  const pos = purchaseLots(db).reverse();
  const label = (id: string) =>
    `${lotLabel(db, id)} · เหลือ ${qty(poInfo(db, id, exceptId).heldKg)} กก.`;
  const pick = (index: number, poLotId: string) => {
    const kg = poLotId
      ? kgValue(
          prefillLineKg(
            db,
            poLotId,
            rows.filter((_, i) => i !== index),
            Number(values.dispatchKg) || null,
            exceptId,
          ),
        )
      : "";
    write(rows.map((row, i) => (i === index ? { poLotId, kg } : row)));
  };
  const status = lineCheck(values);
  const empty = "border-warning/60 bg-warning-subtle";
  return (
    <FormField
      as="div"
      wide
      label={
        <>
          {f.label}
          <Caption as="span" className="font-normal">
            {" "}
            ({f.unit})
          </Caption>
        </>
      }
      hint={f.hint}
    >
      <div className="mt-2 flex flex-col gap-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 max-md:grid-cols-[minmax(0,1fr)_88px_auto]"
          >
            <Select
              aria-label={`PO เนื้อ บรรทัด ${index + 1}`}
              value={row.poLotId}
              className={cn(!row.poLotId && empty)}
              onChange={(event) => pick(index, event.target.value)}
            >
              <option value="">เลือก PO เนื้อ</option>
              {row.poLotId && !pos.some((lot) => lot.id === row.poLotId) && (
                <option value={row.poLotId}>{lotLabel(db, row.poLotId)}</option>
              )}
              {pos
                .filter(
                  (lot) =>
                    lot.id === row.poLotId ||
                    !rows.some((other) => other.poLotId === lot.id),
                )
                .map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {label(lot.id)}
                  </option>
                ))}
            </Select>
            <Input
              aria-label={`กก. บรรทัด ${index + 1}`}
              inputMode="decimal"
              autoComplete="off"
              value={row.kg}
              className={cn(!row.kg && empty)}
              onChange={(event) =>
                write(
                  rows.map((r, i) =>
                    i === index ? { ...r, kg: event.target.value } : r,
                  ),
                )
              }
            />
            <IconButton
              label={`ลบบรรทัด ${index + 1}`}
              icon={<X />}
              onClick={() => write(rows.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {rows.length < pos.length && (
            <Button
              icon={<Plus />}
              onClick={() => write([...rows, { poLotId: "", kg: "" }])}
            >
              เพิ่ม PO เนื้อ
            </Button>
          )}
          <span
            aria-live="polite"
            className={cn(
              "text-body-sm font-semibold",
              status.ok ? "text-success" : "text-warning",
            )}
          >
            {status.text}
          </span>
        </div>
      </div>
    </FormField>
  );
}

/** The live line under a round step: a receipt against what was sent, a smoked weight's waste. */
function roundText(db: Database, kind: NoteKind, lotId: string, v: Values) {
  const raw = kind === "cmReceive" ? v.receivedKg : v.smokedKg;
  if ((kind !== "cmReceive" && kind !== "smoked") || !lotId || !raw) return "";
  const round = roundsOf(db, lotId).find((r) => r.dispatch.id === v.dispatchId);
  const typedKg = Number(raw);
  if (!round || !Number.isFinite(typedKg)) return "";
  if (kind === "cmReceive") {
    const diff = typedKg - round.sentKg;
    return Math.abs(diff) < 0.005
      ? "ตรงกับตอนส่ง"
      : `${diff > 0 ? "+" : "−"}${qty(Math.abs(diff))} กก. จากที่ส่ง ${qty(round.sentKg)} กก.`;
  }
  // The base: what Chef House received this round, else what was sent.
  const base = round.received ? round.receivedKg : round.sentKg;
  const waste = base - typedKg;
  return `Waste ${qty(waste)} กก.${base > 0 ? ` (${qty((waste / base) * 100)}%)` : ""} จาก ${qty(base)} กก.${round.received ? "ที่รับ" : "ที่ส่ง"}`;
}
