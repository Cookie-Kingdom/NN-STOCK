"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Stat } from "@/components/atoms/Stat";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FileUploadField } from "@/components/molecules/FileUploadField";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { PackingListTable } from "@/components/organisms/shared/PackingListTable";
import { usePrefill } from "@/components/organisms/shared/usePrefill";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { saveAttachment } from "@/lib/attachment-store";
import { fmt } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import { lastLabel, lastValue, type Prefill } from "@/lib/prefill";
import {
  entries,
  mutate,
  packingListBoxes,
  shipmentLines,
  titles,
  type Database,
  type Values,
} from "@/lib/store";

const DEFAULT_ROWS = 10;
const MAX_ROWS = 200;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/** Two decimals like the fields, so float noise never shows. */
const round2 = (kg: number) => Math.round(kg * 100) / 100;
/** The filled box weights added up — Sliced Weight Net. */
const boxTotal = (rows: (number | undefined)[]) =>
  round2(rows.reduce<number>((sum, kg) => sum + (kg ?? 0), 0));

/**
 * Foodiva's own Packing List, kept apart from the transport document: the file can
 * arrive broken, or as a photo, so the weights are typed in here rather than parsed.
 * A file may still be attached — as evidence only, since the template it will come
 * in is not known yet.
 *
 * Foodiva fills the Packing List column; the yellow one stays read-only, it belongs
 * to Chef House. Saving with rows left blank asks for confirmation and then stores
 * only the rows that were filled.
 *
 * None of the three weights in the head is typed — the box rows are the only input:
 * - **Inv. Weight** is the kg this shipment's Request asked for from its purchase
 *   PO(s), shown read-only. Change it by changing the Request.
 * - **Sliced Weight Net** is the rows added up. Over Inv. Weight it blocks the save —
 *   `mutate` refuses it.
 * - **Sliced Weight Lost** is the gap between the two, always positive. Zero is a
 *   normal list.
 *
 * With `onDraft` nothing is saved here: the values (file already uploaded) go back to
 * FoodivaDispatchForm, which saves them together with the transport document.
 */
export function PackingListForm({
  db,
  lotId,
  date,
  onDate,
  minDate,
  onClose,
  onSaved,
  draft,
  onDraft,
}: {
  db: Database;
  lotId: string;
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
  onClose: () => void;
  onSaved?: (db: Database) => void;
  /** Values from an earlier `onDraft`, when Foodiva reopens the list before saving. */
  draft?: Values;
  onDraft?: (input: Values) => void;
}) {
  const lot = db.lots.find((l) => l.id === lotId);
  const saved = draft
    ? { values: draft }
    : entries(db, "packingList", lotId).at(-1);
  // Defaults come from the purchase POs on this shipment.
  const lines = lot ? shipmentLines(lot) : [];
  const pos = lines.map((line) => line.lotId);
  /** Inv. Weight, read-only: the kg this shipment's Request asked for from its purchase
   *  PO(s) — the same total the transport document adds up as "รวมที่ส่งเที่ยวนี้", not
   *  the POs' full ordered kg. A list saved before the field went read-only keeps its
   *  own number when the Request's lines can no longer be read. */
  const invWeight =
    round2(lines.reduce((sum, line) => sum + line.kg, 0)) ||
    Number(saved?.values.invWeightKg) ||
    0;
  /* One entry per row, so deleting a row shifts the ones under it up — the box
   * number is the position in the list, the way the saved value stores it. */
  const [weights, setWeights] = useState<(number | undefined)[]>(() => {
    const listed = packingListBoxes(saved?.values.boxes);
    // Editing keeps the saved rows only: padding would re-ask the blank-row confirmation.
    return Array.from(
      { length: listed.length || DEFAULT_ROWS },
      (_, index) => listed[index],
    );
  });
  /** The prefill for the current product. A saved list or draft keeps its own values:
   *  nothing is filled over them. */
  const prefillFor = (product: string): Prefill => {
    const out: Prefill = { values: {}, sources: {} };
    if (saved) return out;
    const add = (key: string, value: string | undefined, label: string) => {
      if (!value) return;
      out.values[key] = value;
      out.sources[key] = { label };
    };
    add(
      "invoiceNo",
      pos
        .map((id) => entries(db, "foodivaConfirm", id).at(-1)?.values.invoiceNo)
        .filter(Boolean)
        .join(", "),
      "ตาม Invoice",
    );
    add(
      "product",
      db.lots.find((l) => l.id === pos[0])?.values.productName,
      "ตาม PO",
    );
    const code = lastValue(db, "packingList", "code", {
      where: (entry) => entry.values.product === product,
    });
    if (code) add("code", code.value, lastLabel(code.date));
    return out;
  };
  const { values, sources, set, refill } = usePrefill(() => {
    const base = {
      invoiceNo: saved?.values.invoiceNo ?? "",
      product: saved?.values.product ?? "",
      code: saved?.values.code ?? "",
    };
    const product =
      saved?.values.product ??
      db.lots.find((l) => l.id === pos[0])?.values.productName ??
      "";
    return { base, prefill: prefillFor(product) };
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState(saved?.values.attachment ?? "");
  const [confirmPartial, setConfirmPartial] = useState(false);
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");

  /** Any change to the rows re-arms the "saving an unfinished list" confirmation. */
  const editRows = (
    next: (current: (number | undefined)[]) => typeof current,
  ) => {
    const rows = next(weights);
    setWeights(rows);
    setConfirmPartial(false);
  };
  const boxes = weights.map((weight, index) => ({ no: index + 1, weight }));
  const filled = boxes.filter((box) => box.weight !== undefined);
  const blank = boxes.length - filled.length;
  /** Sliced Weight Net is not typed — it is the rows added up, the meat that came out
   *  of the cutting. */
  const slicedNet = boxTotal(weights);
  /** Sliced Weight Lost is not typed either — it is what cutting took away, the gap between
   *  Inv. Weight and Sliced Weight Net, as a plain number that is never negative.
   *  Zero is a normal list: the meat weighs exactly what the Request asked for. */
  const slicedLost = round2(Math.abs(invWeight - slicedNet));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!filled.length) return setError("กรอกน้ำหนักอย่างน้อย 1 กล่องรับเข้า");
    // The same rule mutate() enforces, said here so it shows before the save is tried.
    if (invWeight && slicedNet > invWeight + 0.001)
      return setError(
        `น้ำหนักรวมกล่องรับเข้าเกิน Inv. Weight · รวมได้สูงสุด ${fmt(invWeight)} กก.`,
      );
    // First press on an unfinished list only asks; the second one saves what is there.
    if (blank && !confirmPartial) {
      setError("");
      return setConfirmPartial(true);
    }
    const collect = async () => {
      const input: Values = {
        ...values,
        // Not typed: Inv. Weight is the Request's kg, Lost is the gap it leaves.
        invWeightKg: invWeight ? String(invWeight) : "",
        slicedNetKg: String(slicedNet),
        slicedLostKg: String(slicedLost),
        boxes: filled.map((box) => String(box.weight)).join("\n"),
      };
      if (file) {
        input.attachment = file.name;
        input.attachmentStorageKey = await saveAttachment(file);
      } else if (fileName) {
        input.attachment = fileName;
        if (saved?.values.attachmentStorageKey)
          input.attachmentStorageKey = saved.values.attachmentStorageKey;
      }
      return input;
    };
    if (onDraft) {
      try {
        return onDraft(await collect());
      } catch (caught) {
        return setError(
          caught instanceof Error ? caught.message : "แนบไฟล์ไม่สำเร็จ",
        );
      }
    }
    const next = await run(async () =>
      mutate(
        latestDatabase(),
        "foodiva",
        "packingList",
        await collect(),
        lotId,
        date,
      ),
    );
    if (next) onSaved?.(next);
  }

  return (
    <Dialog
      overline={`${date} · Foodiva · ${lot?.poId ?? ""}`}
      title={saved ? "แก้ไข Packing List" : titles.packingList}
      size="wide"
      onClose={onClose}
    >
      <DialogForm noValidate onSubmit={submit}>
        <DialogBody>
          <WorkingDateField
            asField
            date={date}
            onDate={onDate}
            minDate={minDate}
          />
          <Notice>
            กรอกน้ำหนักรายกล่องรับเข้าในคอลัมน์ “น้ำหนักตาม Packing List”
            ช่องสีเหลืองเป็นของ Chef House กรอกตอนรับของ เพิ่มแถวได้ที่ท้ายตาราง
            ลบได้ทีละแถว และดูจำนวนแถวทั้งหมดได้ที่หัวตาราง (สูงสุด {MAX_ROWS}{" "}
            แถว) แนบไฟล์ได้เพื่อเก็บเป็นหลักฐาน ระบบยังไม่ดึงข้อมูลจากไฟล์
            <span className="mt-2 block">
              Inv. Weight มาจาก PO ที่ขอในเที่ยวนี้ แก้ที่นี่ไม่ได้ ·{" "}
              <strong>Sliced Weight Net</strong> คือผลรวมของทุกแถวในตาราง
              ระบบคิดให้ ต้องไม่เกิน Inv. Weight · Sliced Weight Lost
              ระบบคิดให้จากสองค่านี้
            </span>
          </Notice>
          <FormGrid>
            <FormField label="เลข Invoice" prefilled={sources.invoiceNo}>
              <Input
                type="text"
                value={values.invoiceNo}
                onChange={(event) => set("invoiceNo", event.target.value)}
              />
            </FormField>
            <FormField label="รายการสินค้า" prefilled={sources.product}>
              <Input
                type="text"
                value={values.product}
                onChange={(event) => {
                  set("product", event.target.value);
                  // The CODE follows the product until Foodiva types one.
                  refill(prefillFor(event.target.value));
                }}
              />
            </FormField>
            <FormField label="CODE สินค้า" optional prefilled={sources.code}>
              <Input
                type="text"
                value={values.code}
                onChange={(event) => set("code", event.target.value)}
              />
            </FormField>
            {/* Not a field: Inv. Weight belongs to the Owner's Request, so it is shown
                the way the summary cards above the table show theirs. */}
            <Stat
              label={
                <>
                  Inv. Weight (กก.)
                  <span className="mt-1 block">
                    น้ำหนักก่อนตัด · ตาม PO ที่ขอในเที่ยวนี้ แก้ที่นี่ไม่ได้
                  </span>
                </>
              }
              value={invWeight ? `${invWeight.toFixed(2)} กก.` : "—"}
            />
            {/* Not a field either: the rows are the input, this is their total. */}
            <Stat
              label={
                <>
                  Sliced Weight Net (กก.)
                  <span className="mt-1 block">
                    น้ำหนักเนื้อที่ใช้ได้หลังตัด = ผลรวมทุกแถวในตาราง
                  </span>
                </>
              }
              value={`${slicedNet.toFixed(2)} กก.`}
            />
            {/* Not a field: the figure is derived, so it is shown the way the summary
                cards above the table show theirs. */}
            <Stat
              label={
                <>
                  Sliced Weight Lost (กก.)
                  <span className="mt-1 block">
                    น้ำหนักที่หายไปจากการตัด = Inv. Weight − Sliced Weight Net
                  </span>
                </>
              }
              value={`${slicedLost.toFixed(2)} กก.`}
            />
            <FileUploadField
              label="แนบไฟล์ Packing List"
              optional
              accept=".pdf,.csv,.xlsx,.xls,image/*"
              maxBytes={MAX_ATTACHMENT_BYTES}
              oversizeMessage="ไฟล์ Packing List ต้องมีขนาดไม่เกิน 2 MB"
              hint="เก็บเป็นหลักฐานเท่านั้น ข้อมูลที่ใช้จริงคือที่กรอกในตาราง"
              onError={setError}
              onFile={(picked) => {
                setFile(picked);
                setFileName(picked?.name ?? "");
              }}
              fileName={fileName}
            />
          </FormGrid>
          <PackingListTable
            header={{
              date,
              invoiceNo: values.invoiceNo,
              product: values.product,
              code: values.code,
              invWeight: invWeight || undefined,
              // Always a figure, 0.00 included — never the "—" of a missing value.
              slicedNet,
              slicedLost,
            }}
            boxes={boxes}
            onRows={(count) =>
              editRows((current) => {
                const rows = Math.min(Math.max(count, 1), MAX_ROWS);
                return Array.from(
                  { length: rows },
                  (_, index) => current[index],
                );
              })
            }
            onRemoveRow={(no) =>
              editRows((current) => current.filter((_, i) => i !== no - 1))
            }
            onWeight={(no, weight) =>
              editRows((current) =>
                current.map((value, i) => (i === no - 1 ? weight : value)),
              )
            }
          />
          {confirmPartial && (
            <Notice tone="warning" role="alert">
              ยังกรอกไม่ครบ — กรอกแล้ว {filled.length} จาก {boxes.length} แถว
              กดบันทึกอีกครั้งเพื่อยืนยันว่าจะบันทึกเฉพาะ {filled.length}{" "}
              กล่องรับเข้าที่กรอกไว้
            </Notice>
          )}
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          hint={`กรอกแล้ว ${filled.length} จาก ${boxes.length} แถว`}
          onCancel={onClose}
          submitLabel={
            confirmPartial
              ? `ยืนยันบันทึก ${filled.length} กล่องรับเข้า`
              : onDraft
                ? "ใส่ Packing List ในใบขนส่ง"
                : "บันทึก Packing List"
          }
        />
      </DialogForm>
    </Dialog>
  );
}
