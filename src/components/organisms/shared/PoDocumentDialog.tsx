"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Caption } from "@/components/atoms/Text";
import { Dialog } from "@/components/molecules/Dialog";
import {
  DocumentPrintButton,
  poPaperHtml,
} from "@/components/molecules/DocumentPrintButton";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { EntryFieldControl } from "@/components/organisms/shared/EntryFieldControl";
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

/** The sample's form grid: as many 180px columns as fit (as in the composer). */
const grid =
  "my-0 grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-4";

const documentTitle = {
  purchase: "Purchase Order",
  smokeOrder: "Smoke Service Purchase Order",
};

/**
 * A PO เนื้อ or a PO รมควัน as a document: the form on the left, the PO paper it makes on the
 * right (stacked below lg), updated as the user types. 「พิมพ์ / ดาวน์โหลด PDF」 works before
 * saving (the next number, marked ฉบับร่าง); 「บันทึก」 saves through `mutate` like the
 * composer, after which the badge says บันทึกแล้ว and the paper carries the real number. With
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
      className="w-320"
      onClose={onClose}
      title={
        <>
          {titles[kind]} {number}
        </>
      }
      meta={
        clean ? (
          <Badge tone="success">บันทึกแล้ว</Badge>
        ) : saved ? (
          <Badge tone="warning">แก้ไขยังไม่บันทึก</Badge>
        ) : (
          <Badge>ฉบับร่าง</Badge>
        )
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
        <div className="min-h-0 flex-auto overflow-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.95fr)] lg:overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border p-6.5 max-md:p-4 lg:overflow-auto lg:border-r lg:border-b-0">
            <Notice className="my-0">
              เอกสาร PO ในส่วน Preview จะเปลี่ยนตามข้อมูลที่กรอกทันที ·
              พิมพ์ได้ก่อนบันทึก
            </Notice>
            <FormGrid className={grid}>
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
              {shown.map((f, index) => (
                <EntryFieldControl
                  key={f.key}
                  field={f}
                  autoFocus={index === 0 && !saved}
                  values={values}
                  set={set}
                  onFile={() => {}}
                  onFileError={setError}
                />
              ))}
            </FormGrid>
            {kind === "smokeOrder" && !values.serviceRate && rate && (
              <Caption>
                ราคาค่ารมตามน้ำหนัก ฿{rate} / กก. (จาก Settings)
              </Caption>
            )}
            <FormError error={error} className="my-0" />
          </div>
          <section
            aria-label="Preview เอกสาร PO"
            className="bg-bg p-6.5 max-md:p-3 lg:overflow-auto max-md:[&_.po-paper]:p-5"
          >
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
        <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-bg px-6.5 py-4 max-md:px-4 max-md:py-3">
          <Caption className="mr-auto max-md:hidden">
            {clean
              ? "พิมพ์จากข้อมูลที่บันทึกแล้ว"
              : "พิมพ์ได้โดยไม่ต้องบันทึก · เลขที่เอกสารอาจเปลี่ยนเมื่อบันทึก"}
          </Caption>
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
          <Button type="submit" variant="primary" disabled={saving || clean}>
            บันทึก
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
