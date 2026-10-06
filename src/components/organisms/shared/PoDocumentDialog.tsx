"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Caption } from "@/components/atoms/Text";
import { Dialog } from "@/components/molecules/Dialog";
import {
  DocumentPrintButton,
  poPaperHtml,
} from "@/components/molecules/DocumentPrintButton";
import { FormField } from "@/components/molecules/FormField";
import { EntryFieldControl } from "@/components/organisms/shared/EntryFieldControl";
import {
  FieldSections,
  FiguresPanel,
  FormFooter,
  SaveButton,
  fullDay,
} from "@/components/organisms/shared/formParts";
import {
  purchaseOrderRows,
  smokeOrderPrintRows,
} from "@/components/organisms/shared/documentRows";
import { PO_CSS } from "@/components/organisms/shared/printDocumentCss";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { useLogoSrc } from "@/lib/attachment-store";
import { defaults, fields } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  mutate,
  nextNumberPreview,
  smokeServiceRate,
  titles,
  visibleNotes,
  type Values,
} from "@/lib/store";
import { cn } from "@/lib/utils";

const documentTitle = {
  purchase: "Purchase Order",
  smokeOrder: "Smoke Service Purchase Order",
};

/**
 * A PO เนื้อ or a PO รมควัน as a document: the sectioned form on the left, the PO paper it
 * makes on the right (stacked below lg), updated as the user types. 「พิมพ์ / ดาวน์โหลด PDF」
 * works before saving (the next number, marked ฉบับร่าง); 「บันทึก」 saves through `mutate`
 * like the composer, after which the status in the subtitle (a dot and a word) says
 * บันทึกแล้ว and the paper carries the real number. With
 * `entryId` it opens that saved note (view, edit, reprint). Mount to open, unmount to close.
 */
export function PoDocumentDialog({
  ws,
  kind,
  entryId,
  values: preset,
  date: presetDate,
  onClose,
}: {
  ws: Workspace;
  kind: "purchase" | "smokeOrder";
  /** A saved `purchase` / `smokeOrder` note to open. */
  entryId?: string;
  /** Starting values of a new draft (over the kind's defaults). */
  values?: Values;
  /** Starting date of a new draft; today when not given. */
  date?: string;
  onClose: () => void;
}) {
  const { db, account, today } = ws;
  const [savedId, setSavedId] = useState(entryId);
  const saved = savedId
    ? visibleNotes(db, account).find((e) => e.id === savedId)
    : undefined;
  const [values, setValues] = useState<Values>(() =>
    saved ? { ...saved.values } : { ...defaults(kind), ...preset },
  );
  const [date, setDate] = useState(saved?.date ?? presetDate ?? today);
  // Changed since the last save (or since it opened on a saved note).
  const [dirty, setDirty] = useState(false);
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");

  const shown = fields(kind, db, account).filter(
    (f) => !f.when || f.when(values),
  );
  const set = (key: string, value: string) => {
    setValues((last) => ({ ...last, [key]: value }));
    setDirty(true);
    setError("");
  };

  // What the paper shows: the saved note as it is, else the values typed so far, numbered
  // as the save would number them.
  const clean = saved && !dirty;
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
  const title = documentTitle[kind];
  const row = (label: string) =>
    rows.find(([key]) => key === label)?.[1] || "—";
  const core = shown.filter((f) => f.core);
  const [dot, status] = clean
    ? ["bg-success", "บันทึกแล้ว"]
    : saved
      ? ["bg-warning", "ยังไม่ได้บันทึกการแก้ไข"]
      : ["bg-border-strong", "ฉบับร่าง"];

  const save = async () => {
    setError("");
    const next = await run(() =>
      saved
        ? mutate(
            latestDatabase(),
            account,
            "entryEdit",
            {
              targetId: saved.id,
              values: JSON.stringify(values),
              toDate: date,
              toLotId: saved.lotId,
            },
            "",
            today,
          )
        : mutate(latestDatabase(), account, kind, values, "", date),
    );
    if (!next) return;
    if (!saved) setSavedId(next.entries.at(-1)?.id);
    setDirty(false);
    ws.setToast(`${saved ? "แก้แล้ว" : "จดแล้ว"}: ${titles[kind]}`);
  };

  return (
    <Dialog
      size="xl"
      onClose={onClose}
      title={titles[kind]}
      subtitle={
        <>
          {number}
          {date && ` · ${fullDay(date)}`} ·{" "}
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
          save();
        }}
      >
        {/* Below lg the form and its paper stack in one scroll area: two nested scrollers
            in a fixed-height grid each shrink to a sliver on a phone. */}
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
                  onFileError={setError}
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
                    ? "ค่ารมต่อ กก. คิดตามขั้นน้ำหนักใน Settings"
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
                  ? "เอกสารตามข้อมูลที่บันทึกแล้ว"
                  : "ตัวอย่างเปลี่ยนตามข้อมูลที่กรอก พิมพ์ก่อนบันทึกได้ แต่เลขที่เอกสารอาจเปลี่ยนเมื่อบันทึก"}
              </Caption>
            </div>
            <style>{PO_CSS}</style>
            <div
              // Escaped by poPaperHtml: the same markup the print popup writes.
              dangerouslySetInnerHTML={{
                __html: poPaperHtml({
                  title,
                  number,
                  rows,
                  logo,
                  draft: !clean,
                }),
              }}
            />
          </section>
        </div>
        <FormFooter
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
            title={title}
            number={number}
            rows={rows}
            draft={!clean}
            label="พิมพ์ / ดาวน์โหลด PDF"
          />
          <SaveButton saving={saving} disabled={clean} />
        </FormFooter>
      </form>
    </Dialog>
  );
}
