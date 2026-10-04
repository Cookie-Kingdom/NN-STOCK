"use client";

import { useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Caption } from "@/components/atoms/Text";
import { Dialog } from "@/components/molecules/Dialog";
import { FormField } from "@/components/molecules/FormField";
import { EntryFieldControl } from "@/components/organisms/shared/EntryFieldControl";
import {
  FieldSections,
  FiguresPanel,
  FormFooter,
  SaveButton,
  fullDay,
  type Figure,
  type Figures,
} from "@/components/organisms/shared/formParts";
import {
  lotLabel,
  noteAmount,
  noteLine,
} from "@/components/organisms/shared/noteText";
import { PoDocumentDialog } from "@/components/organisms/shared/PoDocumentDialog";
import { useEntryActions } from "@/components/organisms/shared/useEntryActions";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type {
  Draft,
  Workspace,
} from "@/components/organisms/workspace/useWorkspace";
import { saveAttachment } from "@/lib/attachment-store";
import { baht, qty, thaiDay } from "@/lib/format";
import { attachmentFolder, defaults, fields, type Field } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  branches,
  capacityWarning,
  defaultRound,
  dispatchLines,
  isRoundKind,
  itemNoFor,
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
  supplierBalances,
  titles,
  visibleNotes,
  type Actor,
  type Database,
  type Entry,
  type NoteKind,
  type Values,
} from "@/lib/store";
import { ledgerStatuses } from "@/lib/store/ledger";
import { cn } from "@/lib/utils";

/** A kg the web works out, as typed into a field: at most two decimals. */
const kgValue = (x: number) => String(Math.round(x * 100) / 100);
const kgText = (x: number) => `${qty(x)} กก.`;

/** The workspace's dialogs, floating over the page so it stays where it was: the note being
 *  jotted, and the confirm a 「ลบ」 opens. */
export function Composer({ ws }: { ws: Workspace }) {
  return (
    <>
      <DraftDialog ws={ws} />
      {ws.deleting && <ConfirmDelete ws={ws} entry={ws.deleting} />}
    </>
  );
}

/** The dialog where a note is jotted: the form of `draft.kind` (opened by a page's jot
 *  buttons or a todo), or with `editId` the same form on that entry. */
function DraftDialog({ ws }: { ws: Workspace }) {
  const { draft, db, account } = ws;
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
  // 「บันทึกและจดต่อ」 bumps `seq`: a fresh form in a fresh dialog.
  return (
    <NoteForm
      key={draft.seq}
      ws={ws}
      draft={draft}
      kind={kind}
      target={target}
    />
  );
}

/** The step between 「ลบ」 and the delete: which note it is, what follows, and focus on
 *  「ยกเลิก」. Confirming deletes as before, with 「เลิกทำ」 on the toast. */
function ConfirmDelete({ ws, entry }: { ws: Workspace; entry: Entry }) {
  const { db } = ws;
  const { confirmRemove } = useEntryActions(ws);
  const textId = useId();
  const close = () => ws.setDeleting(null);
  const amount = noteAmount(db, entry);
  const rows = [
    ["บันทึก", titles[entry.kind]],
    ["รายละเอียด", noteLine(db, entry) || "—"],
    [
      "วันที่",
      [fullDay(entry.date), entry.lotId && lotLabel(db, entry.lotId)]
        .filter(Boolean)
        .join(" · "),
    ],
    ...(amount ? [["ยอด", amount.text]] : []),
  ];
  return (
    <Dialog
      size="sm"
      title="ลบบันทึกนี้?"
      alert={{ describedBy: textId }}
      onClose={close}
    >
      <div className="flex flex-col gap-4 px-6.5 pt-3 pb-6 max-md:px-4 max-md:pb-4">
        <dl className="m-0 flex flex-col gap-2 rounded-md border border-border bg-bg px-4 py-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-3">
              <dt className="w-20 shrink-0 text-body-sm text-text-secondary">
                {label}
              </dt>
              <dd className="m-0 min-w-0 font-medium [overflow-wrap:anywhere] tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p id={textId} className="m-0 text-body-sm text-text-secondary">
          ตัวเลขที่คิดจากบันทึกนี้จะเปลี่ยนตาม · ยังดูได้ใน ประวัติการแก้ไขและลบ
        </p>
        <div className="flex justify-end gap-2.5 max-md:[&>*]:flex-1">
          <Button data-autofocus onClick={close}>
            ยกเลิก
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              close();
              confirmRemove(entry);
            }}
          >
            ลบ
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** The form of every note kind. `md` and one column for a short note; `lg` with the
 *  「เว็บคิดให้」 rail for a kind the web works figures out for (and, without a rail, for a
 *  long note). */
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

  const shown = fields(kind, db, by, lotId)
    .filter((f) => !f.when || f.when(values))
    .map((f) => {
      // A ledger item: the Item No. the name typed gets (V2-LED-03).
      if (kind !== "expense" || f.key !== "item" || !values.item?.trim())
        return f;
      const no = itemNoFor(db, values.item, target?.values);
      return { ...f, hint: no.isNew ? `ใหม่: ${no.no}` : `Item No. ${no.no}` };
    });
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

  // A dispatch whose PO เนื้อ lines do not add up cannot be saved; the footer says why.
  const gap = kind === "dispatch" ? lineCheck(values).gap : "";
  const figures = noteFigures(kind, db, lotId, values, target);
  const size = figures || shown.length > 8 ? "lg" : "md";
  const core = shown.filter((f) => f.core);
  const picksBranch = info.group === "branch" && account.role !== "branch";

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
    <Dialog
      size={size}
      onClose={ws.closeDraft}
      title={`${target ? "แก้ไข: " : ""}${titles[kind]}`}
      subtitle={[
        target && `แก้ไขบันทึกของ ${thaiDay(target.date)}`,
        lotId && lotLabel(db, lotId),
        picksBranch && `สาขา${branch}`,
        !target && date && fullDay(date),
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <form
        aria-label="จดบันทึก"
        noValidate
        className="flex min-h-0 flex-auto flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
      >
        {/* With a rail the form and the rail scroll on their own from md up; below md they
            stack in one scroll area, the rail as a box under the form. */}
        <div
          className={cn(
            "min-h-0 flex-auto overflow-auto",
            figures &&
              "md:grid md:grid-cols-[minmax(0,1fr)_17.5rem] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden",
          )}
        >
          <div className="flex flex-col gap-5 p-6.5 max-md:p-4 md:overflow-auto">
            <FieldSections
              whenTitle={
                info.lot
                  ? "เมื่อไร และของ PO ไหน"
                  : picksBranch
                    ? "เมื่อไร และของสาขาไหน"
                    : undefined
              }
              shown={shown}
              narrow={size === "md"}
              when={
                <>
                  <FormField label="วันที่">
                    <Input
                      type="date"
                      max={today}
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </FormField>
                  {info.lot && (
                    <FormField
                      label={info.lot === "po" ? "PO เนื้อ" : "PO รมควัน"}
                    >
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
                            ยังไม่มี{" "}
                            {info.lot === "po" ? "PO เนื้อ" : "PO รมควัน"}
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
                  {picksBranch && (
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
                </>
              }
              render={(f, first) =>
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
                    autoFocus={first}
                    values={values}
                    set={set}
                    onFile={onFile}
                    onFileError={setError}
                  />
                )
              }
            />
          </div>
          {figures && (
            <FiguresPanel
              figures={figures}
              className="p-6.5 max-md:m-4 max-md:rounded-lg max-md:border max-md:border-border max-md:p-4 md:overflow-auto md:border-l md:border-border"
            />
          )}
        </div>
        <FormFooter
          stack={size === "md"}
          missing={
            core.length ? core.filter((f) => !values[f.key]).length : undefined
          }
          blocked={gap && `บันทึกไม่ได้ · ${gap}`}
          error={error}
        >
          <Button
            variant="link"
            className="min-h-11 px-2"
            onClick={ws.closeDraft}
          >
            ยกเลิก
          </Button>
          {!target && (
            <Button disabled={saving || !!gap} onClick={() => save(true)}>
              บันทึกและจดต่อ
            </Button>
          )}
          <SaveButton saving={saving} disabled={!!gap} />
        </FormFooter>
      </form>
    </Dialog>
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
/** A dispatch's PO เนื้อ lines against its dispatchKg. `gap` is why it may not be saved, ""
 *  when it may: every line has a PO and a kg, and they add up (`mutate` refuses the rest).
 *  An empty dispatchKg becomes the lines' total (mutate fills it in). */
function lineCheck(values: Values) {
  const rows = formLines(values.poLines);
  const total = rows.reduce((a, row) => a + (Number(row.kg) || 0), 0);
  const target = Number(values.dispatchKg) || 0;
  const left = target - total;
  const even = !target || Math.abs(left) < 0.005;
  const gap = !rows.length
    ? "ยังไม่ได้เลือก PO เนื้อ"
    : even
      ? rows.every((row) => row.poLotId && row.kg.trim())
        ? ""
        : "บรรทัด PO เนื้อยังไม่ครบ"
      : left > 0
        ? `ขาด ${kgText(left)}`
        : `เกิน ${kgText(-left)}`;
  return { total, target, gap };
}

/** 「เว็บคิดให้」 for a note, worked out from what is typed so far; `null` for a kind with
 *  nothing to work out (it gets no rail). */
function noteFigures(
  kind: NoteKind,
  db: Database,
  lotId: string,
  v: Values,
  target?: Entry,
): Figures | null {
  const typed = (key: string) => v[key] && Number.isFinite(Number(v[key]));
  if (kind === "dispatch") {
    // Whether the PO เนื้อ lines add up, and what the PO รมควัน has room for.
    const lines = lineCheck(v);
    const kg = lines.target;
    const room = lotId ? remainingKg(db, lotId, target?.id) : null;
    return {
      rows: [
        { label: "รวมบรรทัด PO เนื้อ", value: kgText(lines.total) },
        { label: "ต้องส่ง", value: kg ? kgText(kg) : "—" },
        {
          label: "ขาด / เกิน",
          value: lines.gap || "ครบ",
          tone: lines.gap ? "warning" : "success",
        },
        {
          label: "PO รมควันรับได้อีก",
          value: room === null ? "—" : kgText(room),
          rule: true,
        },
        {
          label: "เหลือหลังส่งรอบนี้",
          value: room === null ? "—" : kgText(room - kg),
          tone: room !== null && room - kg < 0 ? "warning" : undefined,
        },
      ],
      note:
        lotId && v.dispatchKg ? capacityWarning(db, lotId, kg, target?.id) : "",
    };
  }
  if (kind === "cmReceive" || kind === "smoked") {
    // A round step: a receipt against what was sent, a smoked weight's waste.
    const round = lotId
      ? roundsOf(db, lotId).find((r) => r.dispatch.id === v.dispatchId)
      : undefined;
    if (!round) return { rows: [], note: "เลือกรอบส่งไปรมควันเพื่อดูตัวเลข" };
    if (kind === "cmReceive") {
      const got = typed("receivedKg") ? Number(v.receivedKg) : null;
      const diff = got === null ? 0 : got - round.sentKg;
      const same = Math.abs(diff) < 0.005;
      return {
        rows: [
          { label: "ส่งรอบนี้", value: kgText(round.sentKg) },
          { label: "รับจริง", value: got === null ? "—" : kgText(got) },
          {
            label: "ต่างจากที่ส่ง",
            value:
              got === null
                ? "—"
                : same
                  ? "ตรงกัน"
                  : `${diff > 0 ? "+" : "−"}${kgText(Math.abs(diff))}`,
            tone: got === null ? undefined : same ? "success" : "warning",
            rule: true,
          },
        ],
      };
    }
    // The base: what Chef House received this round, else what was sent.
    const base = round.received ? round.receivedKg : round.sentKg;
    const smoked = typed("smokedKg") ? Number(v.smokedKg) : null;
    const waste = smoked === null ? 0 : base - smoked;
    return {
      rows: [
        {
          label: round.received ? "Chef House รับ" : "ส่งรอบนี้",
          value: kgText(base),
        },
        {
          label: "หลังรมควัน",
          value: smoked === null ? "—" : kgText(smoked),
        },
        {
          label: "Waste",
          value: smoked === null ? "—" : kgText(waste),
          rule: true,
        },
        {
          label: "Waste %",
          value:
            smoked === null || base <= 0
              ? "—"
              : `${qty((waste / base) * 100)}%`,
        },
      ],
    };
  }
  if (kind === "expense") {
    const no = itemNoFor(db, v.item ?? "", target?.values);
    const amount = Number(v.amount) || 0;
    // As the ledger reads a row: a status typed, else paid once it has an amount.
    const status = (v.status ||
      (amount ? "paid" : "pending")) as keyof typeof ledgerStatuses;
    return {
      rows: [
        { label: "Item No.", value: no.no || "—" },
        {
          label: "รายการนี้",
          value: !no.no ? "—" : no.isNew ? "ใหม่" : "เดิม",
        },
        { label: "สถานะ", value: ledgerStatuses[status] ?? "—", rule: true },
        {
          label: "ยอดค้างจ่าย",
          value: baht(status === "pending" ? amount : 0),
          tone: status === "pending" && amount ? "warning" : undefined,
        },
      ],
      note: no.no ? "" : "พิมพ์ชื่อรายการเพื่อดู Item No.",
    };
  }
  if (kind === "pay") {
    const amount = Number(v.amount) || 0;
    const rows: Figure[] = [{ label: "จ่ายครั้งนี้", value: baht(amount) }];
    if (!v.supplier)
      return { rows, note: "ใส่ผู้ขายเพื่อดูยอดค้างจ่ายก่อนและหลังจ่าย" };
    const balance = supplierBalances(db).find((b) => b.supplier === v.supplier);
    // An edit: the saved balance already counts this payment (and its bill), so take the
    // saved one back out before laying what is typed over it.
    const own =
      balance && target?.values.supplier === v.supplier
        ? (Number(target.values.amount) || 0) -
          (Number(target.values.fullAmount) || 0)
        : 0;
    const before = (balance?.left ?? 0) + own + (Number(v.fullAmount) || 0);
    const after = before - amount;
    return {
      rows: [
        ...rows,
        {
          label: `ค้างจ่าย ${v.supplier} ก่อนจ่าย`,
          value: baht(before),
          rule: true,
        },
        {
          label: "หลังจ่าย",
          value: baht(after),
          tone: after > 0 ? "warning" : "success",
        },
      ],
    };
  }
  return null;
}

/** A dispatch's PO เนื้อ lines: rows of [PO | kg | remove]. A PO picked fills its kg with what
 *  it still holds, up to what the dispatch still lacks (`prefillLineKg`); a PO is picked once.
 *  Whether they add up is in the rail. */
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
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-end gap-2 max-md:grid-cols-[minmax(0,1fr)_88px_auto]"
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
              className={cn("text-right tabular-nums", !row.kg && empty)}
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
              icon={<X size={18} />}
              onClick={() => write(rows.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        {rows.length < pos.length && (
          <Button
            icon={<Plus />}
            className="mt-1 w-fit"
            onClick={() => write([...rows, { poLotId: "", kg: "" }])}
          >
            เพิ่ม PO เนื้อ
          </Button>
        )}
      </div>
    </FormField>
  );
}
