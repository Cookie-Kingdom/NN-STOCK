"use client";

/**
 * PROTOTYPE FOR REVIEW — not used by the app. A redesign of every popup (the note form, the
 * PO document, a delete confirm) shown only in Storybook under `Develop/Popups/…`, so the
 * owner can compare it with today's `Dialog` / `Composer` / `PoDocumentDialog` and decide what
 * to adopt. It reuses the app's tokens, atoms, `fields()` and derive functions, keeps its own
 * form state and never saves: the buttons only call the `onSave…` props. The idea it shows:
 * the left side is what you jot (fields in named sections), the right rail 「เว็บคิดให้」 is
 * every figure the web works out from it, and the footer counts what is still not jotted.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Spinner } from "@/components/atoms/Spinner";
import { Caption } from "@/components/atoms/Text";
import {
  DocumentPrintButton,
  poPaperHtml,
} from "@/components/molecules/DocumentPrintButton";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { EntryFieldControl } from "@/components/organisms/shared/EntryFieldControl";
import {
  purchaseOrderRows,
  smokeOrderPrintRows,
} from "@/components/organisms/shared/documentRows";
import {
  lotLabel,
  noteAmount,
  noteLine,
} from "@/components/organisms/shared/noteText";
import { PO_CSS } from "@/components/organisms/shared/printDocumentCss";
import { useLogoSrc } from "@/lib/attachment-store";
import { baht, qty, thaiDay } from "@/lib/format";
import { defaults, fields, type Field } from "@/lib/forms";
import {
  branches,
  capacityWarning,
  defaultRound,
  dispatchLines,
  isRoundKind,
  itemNoFor,
  kindInfo,
  missingText,
  nextNumberPreview,
  poInfo,
  prefillLineKg,
  purchaseLots,
  remainingKg,
  roundsOf,
  shipments,
  smokeServiceRate,
  supplierBalances,
  titles,
  type Actor,
  type Database,
  type Entry,
  type NoteKind,
  type Values,
} from "@/lib/store";
import { ledgerStatuses } from "@/lib/store/ledger";
import { cn } from "@/lib/utils";

/* ───────────────────────────── Shell ───────────────────────────── */

type Size = "sm" | "md" | "lg" | "xl";
/** 420 / 520 / 860 / 1280px: a confirm, a short note, a note with its rail, a PO document. */
const widths: Record<Size, string> = {
  sm: "w-105",
  md: "w-130",
  lg: "w-215",
  xl: "w-320",
};

/**
 * The modal shell: a native `<dialog>` sized by its content. The header is the title, one
 * quiet `subtitle` line of context and the close button. Below md, `sm` is a bottom sheet
 * and the other sizes are full-screen. Escape and the close button call `onClose`; a control
 * marked `data-autofocus` takes focus once it opens. Mount to open, unmount to close.
 */
export function DevDialog({
  title,
  subtitle,
  size = "md",
  alert,
  onClose,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  size?: Size;
  /** A confirm: `role="alertdialog"`, described by this text, and no close button. */
  alert?: { describedBy: string };
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal?.();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      role={alert ? "alertdialog" : undefined}
      aria-labelledby={titleId}
      aria-describedby={alert?.describedBy}
      className={cn(
        "m-auto max-h-[92dvh] max-w-[calc(100%-3rem)] flex-col overflow-hidden rounded-lg bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-text-primary/55 open:flex open:animate-scale-in open:backdrop:animate-fade-in max-md:w-full max-md:max-w-full max-md:open:animate-fade-up dark:backdrop:bg-black/65",
        widths[size],
        size === "sm"
          ? "max-md:mt-auto max-md:mb-0 max-md:rounded-b-none"
          : "max-md:m-0 max-md:h-dvh max-md:max-h-dvh max-md:rounded-none",
      )}
      onCancel={(event) => {
        // Escape: keep the element open and let the parent unmount it.
        event.preventDefault();
        onClose();
      }}
    >
      <header
        className={cn(
          "flex items-start justify-between gap-3 py-4 pr-3 pl-6.5 max-md:py-3 max-md:pr-2 max-md:pl-4",
          alert ? "pr-6.5 pb-0 max-md:pr-4" : "border-b border-border",
        )}
      >
        <div className="min-w-0 py-1">
          <h2 id={titleId} className="m-0 text-h2">
            {title}
          </h2>
          {subtitle && (
            <p className="m-0 text-body-sm text-text-secondary">{subtitle}</p>
          )}
        </div>
        {!alert && (
          <IconButton label="ปิด" icon={<X size={18} />} onClick={onClose} />
        )}
      </header>
      {children}
    </dialog>
  );
}

/* ───────────────────────── Shared form parts ───────────────────────── */

const fullDay = (date: string) =>
  thaiDay(date, { day: "numeric", month: "short", year: "numeric" });
/** A kg the web works out, as typed into a field: at most two decimals. */
const kgValue = (x: number) => String(Math.round(x * 100) / 100);
const kgText = (x: number) => `${qty(x)} กก.`;

type Group = "when" | "detail" | "money" | "extra";
/** Which section a field sits in. ponytail: a rule over the field itself, kept in the
 *  prototype; if this is adopted, a `group` on `Field` in forms.ts says it outright. */
const groupOf = (f: Field): Group =>
  f.key === "dispatchId"
    ? "when"
    : f.unit === "บาท" || f.key === "status" || f.key === "payer"
      ? "money"
      : f.more || f.type === "file" || f.type === "textarea"
        ? "extra"
        : "detail";

/** One section: a small heading over a stable two-column grid (one column on phones and
 *  when `narrow`). `quiet` is the lighter look of the optional last section. */
function Section({
  title,
  hint,
  quiet,
  narrow,
  children,
}: {
  title: string;
  hint?: string;
  quiet?: boolean;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3
        className={cn(
          "m-0 flex flex-wrap items-baseline gap-x-2 text-h3",
          quiet && "text-text-secondary",
        )}
      >
        {title}
        {hint && <Caption className="font-normal">{hint}</Caption>}
      </h3>
      <FormGrid
        className={cn("my-0 items-start gap-4", narrow && "grid-cols-1")}
      >
        {children}
      </FormGrid>
    </section>
  );
}

/** The fields of a form as sections: `when` (the date, lot and branch controls) first, then
 *  the details, the money, and the optional fields shown open under a quieter heading. */
function FieldSections({
  whenTitle = "เมื่อไร",
  when,
  shown,
  narrow,
  render,
}: {
  whenTitle?: string;
  when: ReactNode;
  shown: Field[];
  narrow?: boolean;
  render: (f: Field, first: boolean) => ReactNode;
}) {
  const of = (group: Group) => shown.filter((f) => groupOf(f) === group);
  const first = shown.find((f) => groupOf(f) !== "when");
  const list = (group: Group) => of(group).map((f) => render(f, f === first));
  const extra = of("extra");
  return (
    <>
      <Section title={whenTitle} narrow={narrow}>
        {when}
        {list("when")}
      </Section>
      {of("detail").length > 0 && (
        <Section title="รายละเอียด" narrow={narrow}>
          {list("detail")}
        </Section>
      )}
      {of("money").length > 0 && (
        <Section title="เงิน" narrow={narrow}>
          {list("money")}
        </Section>
      )}
      {extra.length > 0 && (
        <Section
          quiet
          narrow={narrow}
          title={
            extra.some((f) => f.type === "file")
              ? "เอกสารแนบ และหมายเหตุ"
              : "ข้อมูลเพิ่มเติม และหมายเหตุ"
          }
          hint="ไม่บังคับ จดเพิ่มทีหลังได้"
        >
          {list("extra")}
        </Section>
      )}
    </>
  );
}

type Figure = {
  label: string;
  value: string;
  tone?: "success" | "warning";
  /** Starts a new block: a rule above it. */
  rule?: boolean;
};
type Figures = { rows: Figure[]; note?: string };

/** 「เว็บคิดให้」: the figures the web works out from what is typed, as label / value rows. */
function FiguresPanel({
  figures,
  className,
}: {
  figures: Figures;
  className?: string;
}) {
  return (
    <aside aria-label="เว็บคิดให้" className={cn("bg-bg", className)}>
      <h3 className="m-0 text-label text-text-secondary">เว็บคิดให้</h3>
      <dl aria-live="polite" className="m-0 mt-3 flex flex-col gap-2.5">
        {figures.rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-baseline justify-between gap-3",
              row.rule && "border-t border-border pt-2.5",
            )}
          >
            <dt className="text-body-sm text-text-secondary">{row.label}</dt>
            <dd
              className={cn(
                "m-0 text-right font-semibold tabular-nums",
                row.tone === "success" && "text-success",
                row.tone === "warning" && "text-warning",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {figures.note && (
        <p className="m-0 mt-3 text-caption text-warning">{figures.note}</p>
      )}
    </aside>
  );
}

/** The footer: what is still not jotted on the left (live), the actions on the right. A save
 *  error sits directly above it, outside the scroll area. */
function Footer({
  stack,
  missing,
  blocked,
  error,
  children,
}: {
  /** A narrow dialog: the count takes its own line above the actions (always so on phones). */
  stack?: boolean;
  /** Empty core fields; `undefined` when the form has none. */
  missing?: number;
  /** Why 「บันทึก」 is off, said in place of the count. */
  blocked?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <>
      {error && (
        <div className="border-t border-border px-6.5 py-3 max-md:px-4">
          <FormError error={error} className="my-0" />
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-2 border-t border-border bg-bg px-6.5 py-4 max-md:px-4 max-md:py-3">
        <p
          aria-live="polite"
          className={cn(
            "m-0 mr-auto text-body-sm empty:hidden max-md:w-full",
            stack && "w-full",
          )}
        >
          {blocked ? (
            <span className="font-medium text-warning">{blocked}</span>
          ) : missing ? (
            <>
              <span className="font-medium text-warning">
                {missingText} {missing} ช่อง
              </span>
              <span className="text-text-secondary">
                {" "}
                · บันทึกได้ เติมทีหลังได้
              </span>
            </>
          ) : missing === 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <Check size={16} aria-hidden />
              จดครบแล้ว
            </span>
          ) : null}
        </p>
        {children}
      </footer>
    </>
  );
}

const SaveButton = ({
  saving,
  disabled,
}: {
  saving: boolean;
  disabled?: boolean;
}) => (
  <Button type="submit" variant="primary" disabled={saving || disabled}>
    {saving && <Spinner />}
    {saving ? "กำลังบันทึก" : "บันทึก"}
  </Button>
);

/* ─────────────────────────── Note form ─────────────────────────── */

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
/** A dispatch's lines against its dispatchKg (as `lineCheck` in Composer.tsx). */
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
  return { rows, total, target, gap };
}

/** The figures of a note, worked out from what is typed so far; `null` for a kind with
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
      note: lotId && kg ? capacityWarning(db, lotId, kg, target?.id) : "",
    };
  }
  if (kind === "cmReceive" || kind === "smoked") {
    const round = lotId
      ? roundsOf(db, lotId).find((r) => r.dispatch.id === v.dispatchId)
      : undefined;
    if (!round) return { rows: [], note: "เลือกรอบส่งไปรมควันเพื่อดูตัวเลข" };
    if (kind === "cmReceive") {
      const got = typed("receivedKg") ? Number(v.receivedKg) : null;
      const diff = got === null ? 0 : got - round.sentKg;
      return {
        rows: [
          { label: "ส่งรอบนี้", value: kgText(round.sentKg) },
          { label: "รับจริง", value: got === null ? "—" : kgText(got) },
          {
            label: "ต่างจากที่ส่ง",
            value:
              got === null
                ? "—"
                : Math.abs(diff) < 0.005
                  ? "ตรงกัน"
                  : `${diff > 0 ? "+" : "−"}${kgText(Math.abs(diff))}`,
            tone:
              got === null
                ? undefined
                : Math.abs(diff) < 0.005
                  ? "success"
                  : "warning",
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
    // ponytail: read from the saved log, so an edit's own payment is already in `left`;
    // subtract the target's amount when this is wired to a real edit.
    const before =
      (supplierBalances(db).find((b) => b.supplier === v.supplier)?.left ?? 0) +
      (Number(v.fullAmount) || 0);
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
 *  it still holds, up to what the dispatch still lacks. Whether they add up is in the rail. */
function PoLines({
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
  exceptId?: string;
}) {
  const rows = formLines(values[f.key]);
  const write = (next: Line[]) =>
    set(f.key, next.length ? JSON.stringify(next) : "");
  const pos = purchaseLots(db).reverse();
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
                    {lot.poId} · เหลือ{" "}
                    {kgText(poInfo(db, lot.id, exceptId).heldKg)}
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

export type DevNoteDialogProps = {
  db: Database;
  /** The account jotting: its choices, and whether it picks a branch. */
  by: Actor;
  today: string;
  kind: NoteKind;
  /** The entry being edited: its values, its date, no 「บันทึกและจดต่อ」. */
  target?: Entry;
  lotId?: string;
  /** Starting values of a new note (over the kind's defaults). */
  values?: Values;
  branch?: string;
  /** Shows the saving state: the spinner on 「บันทึก」, every action off. */
  saving?: boolean;
  /** Shows a refused save, directly above the footer. */
  error?: string;
  onClose: () => void;
  onSave: (values: Values) => void;
  onSaveAgain: (values: Values) => void;
};

/** The form of every note kind. `md` and one column for a short note; `lg` with the
 *  「เว็บคิดให้」 rail for a kind the web works figures out for (and, without a rail, for a
 *  long note). */
export function DevNoteDialog({
  db,
  by,
  today,
  kind,
  target,
  lotId: presetLot,
  values: preset,
  branch: presetBranch,
  saving = false,
  error = "",
  onClose,
  onSave,
  onSaveAgain,
}: DevNoteDialogProps) {
  const info = kindInfo[kind];
  // Newest first. A PO kind goes on a PO เนื้อ, the other lot kinds on a PO รมควัน.
  const lots = (
    info.lot === "po" ? purchaseLots(db) : info.lot ? shipments(db) : []
  ).reverse();
  const [lotId, setLotId] = useState(
    target?.lotId ??
      presetLot ??
      (info.lot === "optional" ? "" : (lots[0]?.id ?? "")),
  );
  /** What the web fills in for the lot picked: a dispatch the kg the PO รมควัน has left, a
   *  round step its round. */
  const prefill = (lot: string): Values => {
    if (isRoundKind(kind))
      return { dispatchId: (lot && defaultRound(db, lot, kind)?.id) || "" };
    const left = lot && kind === "dispatch" ? remainingKg(db, lot) : 0;
    return left > 0 ? { dispatchKg: kgValue(left) } : {};
  };
  const [values, setValues] = useState<Values>(() => {
    if (!target)
      return { ...defaults(kind, db.config), ...prefill(lotId), ...preset };
    const v = { ...target.values };
    // A dispatch saved with one PO เนื้อ (poLotId) opens as one line.
    if (kind === "dispatch" && !v.poLines && v.poLotId)
      v.poLines = JSON.stringify(dispatchLines(v));
    return v;
  });
  const [date, setDate] = useState(target?.date ?? today);
  const [branch, setBranch] = useState(
    target?.branch || presetBranch || branches[0],
  );
  const set = (key: string, value: string) =>
    setValues((last) => ({ ...last, [key]: value }));

  const shown = fields(kind, db, by, lotId).filter(
    (f) => !f.when || f.when(values),
  );
  const figures = noteFigures(kind, db, lotId, values, target);
  const size: Size = figures || shown.length > 8 ? "lg" : "md";
  const core = shown.filter((f) => f.core);
  const missing = core.filter((f) => !values[f.key]).length;
  const gap = kind === "dispatch" ? lineCheck(values).gap : "";
  const picksBranch = info.group === "branch" && by.role !== "branch";

  return (
    <DevDialog
      size={size}
      onClose={onClose}
      title={titles[kind]}
      subtitle={[
        target && `แก้ไขบันทึกของ ${thaiDay(target.date)}`,
        lotId && lotLabel(db, lotId),
        picksBranch && `สาขา${branch}`,
        !target && fullDay(date),
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
          onSave(values);
        }}
      >
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
                        onChange={(event) => {
                          setLotId(event.target.value);
                          setValues((last) => ({
                            ...last,
                            ...prefill(event.target.value),
                          }));
                        }}
                      >
                        {info.lot === "optional" && !target?.lotId && (
                          <option value="">ไม่ระบุ PO รมควัน</option>
                        )}
                        {info.lot !== "optional" && !lots.length && (
                          <option value="">
                            ยังไม่มี{" "}
                            {info.lot === "po" ? "PO เนื้อ" : "PO รมควัน"}
                          </option>
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
                  <PoLines
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
                    onFile={(key, file) => set(key, file?.name ?? "")}
                    onFileError={() => {}}
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
        <Footer
          stack={size === "md"}
          missing={core.length ? missing : undefined}
          blocked={gap && `บันทึกไม่ได้ · ${gap}`}
          error={error}
        >
          <Button variant="link" className="min-h-11 px-2" onClick={onClose}>
            ยกเลิก
          </Button>
          {!target && (
            <Button
              disabled={saving || !!gap}
              onClick={() => onSaveAgain(values)}
            >
              บันทึกและจดต่อ
            </Button>
          )}
          <SaveButton saving={saving} disabled={!!gap} />
        </Footer>
      </form>
    </DevDialog>
  );
}

/* ───────────────────────── Confirm delete ───────────────────────── */

/**
 * ใหม่ — ยังไม่มีในแอป: today 「ลบ」 deletes at once and its toast offers 「เลิกทำ」
 * (`useEntryActions`). This is the confirm step it could get: what is being deleted, what
 * follows, and focus on 「ยกเลิก」.
 */
export function DevConfirmDelete({
  db,
  entry,
  onClose,
  onConfirm,
}: {
  db: Database;
  entry: Entry;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const textId = useId();
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
    <DevDialog
      size="sm"
      title="ลบบันทึกนี้?"
      alert={{ describedBy: textId }}
      onClose={onClose}
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
          ตัวเลขที่คิดจากบันทึกนี้จะเปลี่ยนตาม · ยังดูได้ใน Change log
        </p>
        <div className="flex justify-end gap-2.5 max-md:[&>*]:flex-1">
          <Button data-autofocus onClick={onClose}>
            ยกเลิก
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            ลบ
          </Button>
        </div>
      </div>
    </DevDialog>
  );
}

/* ─────────────────────────── PO document ─────────────────────────── */

const documentTitle = {
  purchase: "Purchase Order",
  smokeOrder: "Smoke Service Purchase Order",
};

/** A PO เนื้อ / PO รมควัน as a document: the sectioned form on the left, the PO paper it
 *  makes on the right (stacked below lg). The document's status is a dot and a word in the
 *  header's subtitle; with `saved` it opens on that note. */
export function DevPoDocument({
  db,
  by,
  today,
  kind,
  saved,
  values: preset,
  saving = false,
  error = "",
  onClose,
  onSave,
}: {
  db: Database;
  by: Actor;
  today: string;
  kind: "purchase" | "smokeOrder";
  /** A saved `purchase` / `smokeOrder` note to open. */
  saved?: Entry;
  values?: Values;
  saving?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (values: Values) => void;
}) {
  const [values, setValues] = useState<Values>(() =>
    saved ? { ...saved.values } : { ...defaults(kind), ...preset },
  );
  const [date, setDate] = useState(saved?.date ?? today);
  const [dirty, setDirty] = useState(false);
  const set = (key: string, value: string) => {
    setValues((last) => ({ ...last, [key]: value }));
    setDirty(true);
  };
  const shown = fields(kind, db, by).filter((f) => !f.when || f.when(values));
  const core = shown.filter((f) => f.core);

  // What the paper shows: the saved note as it is, else the values typed so far, numbered
  // as the save would number them (as PoDocumentDialog).
  const clean = !!saved && !dirty;
  const lot = saved && db.lots.find((l) => l.id === saved.lotId);
  const number =
    (kind === "purchase" ? lot?.poId : saved?.values.orderNumber) ||
    nextNumberPreview(db, kind, date) ||
    "—";
  const kg = Number(values.rawKg) || 0;
  const rate =
    values.serviceRate || (kg ? String(smokeServiceRate(db.config, kg)) : "");
  const note = clean
    ? saved
    : {
        date,
        values:
          kind === "purchase"
            ? values
            : {
                ...values,
                serviceRate: rate,
                estimatedCost: kg && rate ? String(kg * Number(rate)) : "",
                orderNumber: number,
              },
      };
  const rows =
    kind === "purchase"
      ? purchaseOrderRows(db, note)
      : smokeOrderPrintRows(db, lot || undefined, note);
  const logo = useLogoSrc(rows.find(([key]) => key === "โลโก้")?.[1]);
  const row = (label: string) =>
    rows.find(([key]) => key === label)?.[1] || "—";
  const [dot, status] = clean
    ? ["bg-success", "บันทึกแล้ว"]
    : saved
      ? ["bg-warning", "แก้ไขยังไม่บันทึก"]
      : ["bg-border-strong", "ฉบับร่าง"];

  return (
    <DevDialog
      size="xl"
      onClose={onClose}
      title={titles[kind]}
      subtitle={
        <>
          {number} · {fullDay(date)} ·{" "}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", dot)} />
            {status}
          </span>
        </>
      }
    >
      <form
        noValidate
        aria-label={titles[kind]}
        className="flex min-h-0 flex-auto flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(values);
        }}
      >
        <div className="min-h-0 flex-auto overflow-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.95fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
          <div className="flex flex-col gap-5 border-b border-border p-6.5 max-md:p-4 lg:overflow-auto lg:border-r lg:border-b-0">
            <FieldSections
              shown={shown}
              when={
                <FormField label="วันที่">
                  <Input
                    type="date"
                    max={today}
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setDirty(true);
                    }}
                  />
                </FormField>
              }
              render={(f, first) => (
                <EntryFieldControl
                  key={f.key}
                  field={f}
                  autoFocus={first && !saved}
                  values={values}
                  set={set}
                  onFile={() => {}}
                  onFileError={() => {}}
                />
              )}
            />
            <FiguresPanel
              className="rounded-lg border border-border p-4"
              figures={{
                rows: [
                  { label: "จำนวน", value: row("จำนวน") },
                  { label: "ราคา / กก.", value: row("ราคา / กก.") },
                  {
                    label: "ยอดรวมก่อน VAT",
                    value: row("ยอดรวมก่อน VAT"),
                    rule: true,
                  },
                ],
                note:
                  kind === "smokeOrder" && !values.serviceRate && rate
                    ? "ราคาค่ารมคิดตามขั้นน้ำหนักใน Settings"
                    : "",
              }}
            />
          </div>
          <section
            aria-label="Preview เอกสาร PO"
            className="flex flex-col gap-3 bg-bg p-6.5 max-md:p-3 lg:overflow-auto max-md:[&_.po-paper]:p-5"
          >
            <div>
              <h3 className="m-0 text-label text-text-secondary">Preview</h3>
              <Caption className="block">
                {clean
                  ? "พิมพ์จากข้อมูลที่บันทึกแล้ว"
                  : "เปลี่ยนตามข้อมูลที่กรอกทันที · พิมพ์ได้ก่อนบันทึก เลขที่เอกสารอาจเปลี่ยนเมื่อบันทึก"}
              </Caption>
            </div>
            <style>{PO_CSS}</style>
            <div
              // Escaped by poPaperHtml: the same markup the print popup writes.
              dangerouslySetInnerHTML={{
                __html: poPaperHtml({
                  title: documentTitle[kind],
                  number,
                  rows,
                  logo,
                  draft: !clean,
                }),
              }}
            />
          </section>
        </div>
        <Footer
          missing={
            core.length ? core.filter((f) => !values[f.key]).length : undefined
          }
          error={error}
        >
          <Button variant="link" className="min-h-11 px-2" onClick={onClose}>
            {clean ? "ปิด" : "ยกเลิก"}
          </Button>
          <DocumentPrintButton
            size="md"
            title={documentTitle[kind]}
            number={number}
            rows={rows}
            draft={!clean}
            label="พิมพ์ / PDF"
          />
          <SaveButton saving={saving} disabled={clean} />
        </Footer>
      </form>
    </DevDialog>
  );
}
