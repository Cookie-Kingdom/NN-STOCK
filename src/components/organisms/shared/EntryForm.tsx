"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
import { FileUploadField } from "@/components/molecules/FileUploadField";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { ReferenceCard } from "@/components/molecules/ReferenceCard";
import { DailySummary } from "@/components/organisms/branch/DailySummary";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import { PackWeightFields } from "@/components/organisms/shared/PackWeightFields";
import { Preview } from "@/components/organisms/shared/Preview";
import { PurchaseOrderDocumentPreview } from "@/components/organisms/shared/PurchaseOrderDocumentPreview";
import { referenceDocument } from "@/components/organisms/shared/referenceDocument";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { saveAttachment } from "@/lib/attachment-store";
import { defaults, forms } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import { prefillValues } from "@/lib/prefill";
import {
  allocationOutstanding,
  balance,
  centralBagStock,
  centralStock,
  cookedRiceStock,
  entries,
  mutate,
  n,
  roleName,
  smokingInvoiceRejection,
  stages,
  titles,
  type Database,
  type Role,
  type Values,
} from "@/lib/store";
import { fmt } from "@/lib/format";
import { type Modal } from "@/lib/nav";
import { cn } from "@/lib/utils";

type FieldSpec = NonNullable<(typeof forms)[keyof typeof forms]>[number];

const submitLabels: Record<string, string> = {
  closeDay: "ยืนยันปิดวัน",
  purchase: "บันทึก PO เนื้อ",
  smokeOrder: "บันทึก PO รมควันเนื้อ",
  smokingInvoice: "Submit ใบวางบิล",
  dispatch: "สร้างใบขนส่งขาไป",
  return: "สร้างใบขนส่งขากลับ",
};

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/** One control from `forms[kind]`, rendered by its `type`. */
function EntryFieldControl({
  field: f,
  autoFocus,
  values,
  set,
  onFile,
  onFileError,
}: {
  field: FieldSpec;
  autoFocus: boolean;
  values: Values;
  set: (key: string, value: string) => void;
  onFile: (key: string, file: File | null) => void;
  onFileError: (message: string) => void;
}) {
  if (f.type === "file")
    return (
      <FileUploadField
        label={f.label}
        optional={f.optional}
        hint={f.hint}
        accept={f.accept}
        required={!f.optional}
        maxBytes={MAX_ATTACHMENT_BYTES}
        oversizeMessage="ไฟล์ Invoice ต้องมีขนาดไม่เกิน 2 MB"
        onError={onFileError}
        onFile={(file) => onFile(f.key, file)}
        fileName={values[f.key]}
      />
    );
  return (
    <FormField
      label={f.label}
      optional={f.optional}
      hint={f.hint}
      wide={f.type === "textarea"}
    >
      {f.type === "select" ? (
        <Select
          value={values[f.key] || ""}
          required={!f.optional}
          onChange={(e) => set(f.key, e.target.value)}
        >
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      ) : f.type === "location" ? (
        <>
          <Select
            value={values[f.key] || ""}
            required
            onChange={(e) => set(f.key, e.target.value)}
          >
            {f.options!.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
          {values[f.key] === "อื่น ๆ" && (
            <Input
              autoFocus
              placeholder="พิมพ์จังหวัด / จุดส่งเอง"
              value={values[`${f.key}Custom`] || ""}
              onChange={(e) => set(`${f.key}Custom`, e.target.value)}
            />
          )}
        </>
      ) : f.type === "textarea" ? (
        <Textarea
          compact={f.key === "note"}
          required={!f.optional}
          rows={f.key === "packs" ? 5 : f.key === "note" ? 1 : 3}
          value={values[f.key] || ""}
          onChange={(e) => set(f.key, e.target.value)}
        />
      ) : (
        <Input
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
          type={f.type === "time" ? "text" : f.type || "text"}
          placeholder={f.type === "time" ? "08:00" : undefined}
          pattern={
            f.type === "time" ? "([01][0-9]|2[0-3]):[0-5][0-9]" : undefined
          }
          inputMode={f.type === "number" ? "decimal" : undefined}
          min={
            f.type === "number"
              ? f.zero
                ? 0
                : f.integer
                  ? 1
                  : 0.01
              : undefined
          }
          step={
            f.type === "number"
              ? f.integer
                ? 1
                : f.key === "packKg"
                  ? 0.001
                  : 0.01
              : undefined
          }
          max={f.key === "tolerance" ? 100 : undefined}
          required={!f.optional}
          value={values[f.key] ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
        />
      )}
    </FormField>
  );
}

export function EntryForm({
  db,
  role,
  date,
  onDate,
  minDate,
  modal,
  onClose,
  onSaved,
  branch,
}: {
  db: Database;
  role: Role;
  /** The workspace branch: the branch account's own, or config.branch for other roles. */
  branch: string;
  date: string;
  /** Sets the workspace date: the form has no date of its own. */
  onDate: (date: string) => void;
  minDate?: string;
  modal: Modal;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const kind = modal.kind;
  const [values, setValues] = useState<Values>(() => {
    if (kind === "config") return { ...db.config };
    const modalLot = db.lots.find((item) => item.id === modal.lotId);
    const base = {
      ...defaults(kind, date),
      ...prefillValues(db, kind, modalLot),
    };
    if (kind === "closeDay") base.time = db.config.closeTime || "22:00";
    return base;
  });
  const useLot = [
    "receive",
    "thaw",
    "sale",
    "influencerBox",
    "allocate",
  ].includes(kind);
  const choices = db.lots.filter(
    (l) =>
      l.stage >= 8 &&
      (role === "owner" || entries(db, "allocate", l.id, branch).length),
  );
  // A lot the form cannot use would leave the required select empty and the
  // browser would block submit before onSubmit, with no message from us.
  const [lotId, setLotId] = useState(
    useLot && !choices.some((l) => l.id === modal.lotId)
      ? (choices[0]?.id ?? "")
      : modal.lotId,
  );
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const attachmentFiles = useRef<Record<string, File>>({});
  const lot = db.lots.find((l) => l.id === lotId);
  const allocations = entries(db, "allocate", lotId, branch)
    .map((e) => {
      const left = allocationOutstanding(db, e);
      return { entry: e, outstanding: left.kg, outstandingBags: left.bags };
    })
    .filter((a) => a.outstanding > 0);
  const latestSmokingInvoice =
    kind === "smokingInvoice" && lot
      ? entries(db, "smokingInvoice", lot.id).at(-1)
      : undefined;
  const rejection =
    latestSmokingInvoice && smokingInvoiceRejection(db, latestSmokingInvoice);
  const reference =
    lot && !useLot ? referenceDocument(db, kind, lot) : undefined;
  const formFields = (forms[kind] || []).filter((field) => {
    if (kind === "smoke" && field.key === "packs") return false;
    if (kind === "supplyPurchase" || kind === "ricePurchase")
      return branch === "มีนบุรี"
        ? !["rawRiceKg", "rawRiceCost"].includes(field.key)
        : !["cookedRiceKg", "cookedRiceCost"].includes(field.key);
    if (kind === "supplyIssue" && branch === "มีนบุรี")
      return field.key !== "rawRiceIssuedKg";
    return true;
  });
  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setError("");
  };
  const setFile = (key: string, file: File | null) => {
    if (!file) {
      set(key, "");
      delete attachmentFiles.current[key];
      return;
    }
    attachmentFiles.current[key] = file;
    set(key, file.name);
  };
  const isPurchaseOrder = kind === "purchase" || kind === "smokeOrder";
  const title =
    kind === "ricePurchase" && branch === "ศาลาแดง"
      ? "ซื้อข้าวเหนียวดิบเข้าสต๊อก · กิโลกรัม"
      : titles[kind];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // run() rebuilds the change after a revision conflict; upload each file once.
    const uploaded: Record<string, string> = {};
    const saved = await run(async () => {
      const resolvedValues = { ...values };
      for (const key of ["origin", "destination"]) {
        if (resolvedValues[key] === "อื่น ๆ") {
          const custom = resolvedValues[`${key}Custom`]?.trim();
          if (!custom)
            throw new Error(
              `กรุณาระบุ${key === "origin" ? "ต้นทาง" : "ปลายทาง"}เอง`,
            );
          resolvedValues[key] = custom;
        }
      }
      for (const [key, file] of Object.entries(attachmentFiles.current)) {
        resolvedValues[`${key}StorageKey`] = uploaded[key] ??=
          await saveAttachment(file);
      }
      /* ponytail: no legacy-attachment migration here any more. Persistence sends
       * the loaded history back untouched (the server rejects edited entries), so
       * the rewrite was discarded, and its re-upload of every old file on each
       * submit could stall or fail a PO or sale that never touched a file. */
      return mutate(
        latestDatabase(),
        role,
        kind,
        resolvedValues,
        lotId,
        date,
        branch,
      );
    });
    if (saved) onSaved(saved);
  }
  return (
    <Dialog
      overline={`${date} · ${roleName[role]}`}
      title={title}
      size={isPurchaseOrder ? "preview" : "default"}
      onClose={onClose}
    >
      {/* noValidate: a native `required` bubble is not in the DOM and Escape on it
          also closes the dialog. Let mutate() refuse and say why in FormError. */}
      <form
        className="flex min-h-0 flex-1 flex-col"
        noValidate
        onSubmit={submit}
      >
        {/* Below lg the PO form and its preview stack in one scroll area: two nested
            scrollers in a fixed-height grid each shrink to a sliver on a phone. */}
        <div
          className={
            isPurchaseOrder
              ? "min-h-0 flex-1 overflow-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.95fr)] lg:overflow-hidden"
              : "min-h-0 flex-1 overflow-auto"
          }
        >
          <DialogBody
            className={cn(
              isPurchaseOrder
                ? "border-b border-border max-lg:overflow-visible lg:border-r lg:border-b-0"
                : "overflow-visible",
            )}
          >
            <WorkingDateField
              className="mb-4.5 max-w-xs text-body-sm font-medium"
              date={date}
              onDate={onDate}
              minDate={minDate}
            />
            {isPurchaseOrder && (
              <Notice className="mb-4.5">
                เอกสาร PO ในส่วน Preview จะเปลี่ยนตามข้อมูลที่กรอกทันที
              </Notice>
            )}
            {lot && !useLot && (
              <Notice>
                {lot.id} · {stages[lot.stage]}
              </Notice>
            )}
            {useLot && (
              <FormField label="Lot ต้นทาง">
                <Select
                  autoFocus
                  data-autofocus
                  value={lotId}
                  required
                  onChange={(e) => {
                    setLotId(e.target.value);
                    set("allocation", "");
                  }}
                >
                  <option value="">เลือก Lot</option>
                  {choices.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id} ·{" "}
                      {kind === "allocate"
                        ? `${fmt(centralStock(db, l.id))} กก. · ${centralBagStock(db, l.id)} ถุงในคลังกลาง`
                        : `${fmt(balance(db, l.id, branch).frozen)} แช่แข็ง / ${fmt(balance(db, l.id, branch).ready)} พร้อมขาย`}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            {kind === "receive" && (
              <FormField
                label="ใบจัดสรรที่รับ"
                hint={
                  !allocations.length
                    ? "ยังไม่มีใบจัดสรรค้างรับของ Lot นี้"
                    : undefined
                }
              >
                <Select
                  required
                  value={values.allocation || ""}
                  onChange={(e) => {
                    const picked = allocations.find(
                      (a) => a.entry.id === e.target.value,
                    );
                    set("allocation", e.target.value);
                    // Bag count only: the kg is weighed at the branch.
                    if (picked && picked.outstandingBags > 0)
                      set("bags", String(picked.outstandingBags));
                  }}
                >
                  <option value="">เลือกใบจัดสรร</option>
                  {allocations.map((a) => (
                    <option key={a.entry.id} value={a.entry.id}>
                      {a.entry.date} · ค้างรับ {fmt(a.outstanding)} กก. ·{" "}
                      {a.entry.id.slice(0, 6)}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            {kind === "closeDay" && (
              <DailySummary db={db} branch={branch} date={date} />
            )}
            {rejection && (
              <Notice tone="warning" className="mt-3">
                {`Owner ส่งกลับแก้ไขใบวางบิล ${latestSmokingInvoice?.values.invoiceNumber || ""} · หมายเหตุ: ${rejection.values.comment?.trim() || "ไม่ได้ระบุ"}`}
                {rejection.values.reviewedBy &&
                  ` · ผู้ตรวจ ${rejection.values.reviewedBy}`}
              </Notice>
            )}
            {kind === "smoke" && (
              <Notice>
                บันทึกครั้งละ 1 รอบสโมค ระบบจะสร้าง Lot สโมครายวันแยกให้
                และเก็บวันที่ จำนวนถุง น้ำหนักถุง และ Waste ใน Log
              </Notice>
            )}
            {kind === "foodivaConfirm" && (
              <Notice>
                แบ่งน้ำหนักตาม Invoice ให้ครบทุกกิโล: พร้อมส่ง Chef_house
                ที่เชียงใหม่ + เนื้อส่วนที่เหลือรอ Owner รับ (Waste)
                ต้องรวมเท่ากับน้ำหนักตาม Invoice
              </Notice>
            )}
            {kind === "unlock" && (
              <Notice tone="warning">
                ปลดล็อกให้เพิ่มรายการแก้ไขของสาขาได้ ประวัติเดิมจะยังอยู่ ยอดขาย
                สต๊อก และรายงานจะคำนวณเพิ่มจากรายการใหม่
              </Notice>
            )}
            {(kind === "supplyPurchase" || kind === "ricePurchase") &&
              branch === "มีนบุรี" && (
                <Notice>
                  ข้าวเหนียวสุกคงเหลือ {fmt(cookedRiceStock(db, branch))} กก. ·
                  ควรซื้อเพิ่มอย่างน้อย{" "}
                  {fmt(
                    Math.max(
                      0,
                      n(db.config, "cookedRicePar") -
                        cookedRiceStock(db, branch),
                    ),
                  )}{" "}
                  กก. เพื่อให้พร้อมขายไม่น้อยกว่า{" "}
                  {fmt(n(db.config, "cookedRicePar"))} กก.
                  {cookedRiceStock(db, branch) <= 0.001
                    ? " · วันแรกปกติซื้อประมาณ 31–33 กก."
                    : " · ระบบหักของเหลือที่นำกลับมาอุ่นแล้ว จึงซื้อวันถัดไปน้อยลงได้"}
                </Notice>
              )}
            <div className="my-4.5 grid grid-cols-2 gap-4.5 max-md:grid-cols-1 max-md:gap-4">
              {formFields.map((f, index) => (
                <EntryFieldControl
                  key={f.key}
                  field={f}
                  autoFocus={index === 0 && !useLot}
                  values={values}
                  set={set}
                  onFile={setFile}
                  onFileError={setError}
                />
              ))}
              {kind === "smoke" && (
                <PackWeightFields
                  value={values.packs || ""}
                  onChange={(value) => set("packs", value)}
                />
              )}
            </div>
            {reference && (
              <ReferenceCard
                title={reference.title}
                number={reference.number}
                rows={reference.rows.filter(([label]) =>
                  reference.summary.includes(label),
                )}
                action={
                  <DocumentPrintButton
                    title={reference.title}
                    number={reference.number}
                    rows={reference.rows}
                    label="ดูเอกสาร"
                    preview
                  />
                }
              />
            )}
            {!isPurchaseOrder && kind !== "cmReceive" && (
              <Preview
                db={db}
                branch={branch}
                lot={lot}
                kind={kind}
                v={values}
              />
            )}
            <FormError error={error} />
          </DialogBody>
          {isPurchaseOrder && (
            <PurchaseOrderDocumentPreview
              db={db}
              lot={lot}
              kind={kind}
              values={values}
              date={date}
            />
          )}
        </div>
        <DialogFooter
          submitDisabled={saving}
          hint={
            isPurchaseOrder
              ? "ตรวจ Preview ก่อนบันทึก PO"
              : kind === "smokingInvoice"
                ? "ระบบจะคำนวณยอดตาม PO ให้ Owner ตรวจหลัง Submit"
                : "ไฟล์แนบจะถูกอัปโหลดไปเก็บบนระบบ (สำรองไว้ในเบราว์เซอร์นี้ด้วย)"
          }
          onCancel={onClose}
          submitLabel={submitLabels[kind] ?? "บันทึกรายการ"}
        />
      </form>
    </Dialog>
  );
}
