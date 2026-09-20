"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
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
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { saveAttachment } from "@/lib/attachment-store";
import { latestDatabase } from "@/lib/persistence";
import {
  entries,
  mutate,
  packingListBoxes,
  titles,
  type Database,
} from "@/lib/store";

const DEFAULT_ROWS = 10;
const MAX_ROWS = 200;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/**
 * Foodiva's own Packing List, kept apart from the transport document: the file can
 * arrive broken, or as a photo, so the weights are typed in here rather than parsed.
 * A file may still be attached — as evidence only, since the template it will come
 * in is not known yet.
 *
 * Foodiva fills the Packing List column; the yellow one stays read-only, it belongs
 * to Chef House. Saving with rows left blank asks for confirmation and then stores
 * only the rows that were filled.
 */
export function PackingListForm({
  db,
  lotId,
  date,
  onDate,
  minDate,
  onClose,
  onSaved,
}: {
  db: Database;
  lotId: string;
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const lot = db.lots.find((l) => l.id === lotId);
  const saved = entries(db, "packingList", lotId).at(-1);
  const invoice = entries(db, "foodivaConfirm", lotId).at(-1);
  const [values, setValues] = useState({
    invoiceNo: saved?.values.invoiceNo ?? invoice?.values.invoiceNo ?? "",
    product: saved?.values.product ?? lot?.values.productName ?? "",
    code: saved?.values.code ?? "",
    invWeightKg:
      saved?.values.invWeightKg ?? invoice?.values.readyForChiangMaiKg ?? "",
  });
  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  /* One entry per row, so deleting a row shifts the ones under it up — the box
   * number is the position in the list, the way the saved value stores it. */
  const [weights, setWeights] = useState<(number | undefined)[]>(() => {
    const listed = packingListBoxes(saved?.values.boxes);
    return Array.from(
      { length: Math.max(DEFAULT_ROWS, listed.length) },
      (_, index) => listed[index],
    );
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState(saved?.values.attachment ?? "");
  const [confirmPartial, setConfirmPartial] = useState(false);
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");

  /** Any change to the rows re-arms the "saving an unfinished list" confirmation. */
  const editRows = (
    next: (current: (number | undefined)[]) => typeof current,
  ) => {
    setWeights(next);
    setConfirmPartial(false);
  };
  const boxes = weights.map((weight, index) => ({ no: index + 1, weight }));
  const filled = boxes.filter((box) => box.weight !== undefined);
  const blank = boxes.length - filled.length;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!filled.length) return setError("กรอกน้ำหนักอย่างน้อย 1 กล่องรับเข้า");
    // First press on an unfinished list only asks; the second one saves what is there.
    if (blank && !confirmPartial) {
      setError("");
      return setConfirmPartial(true);
    }
    const next = await run(async () => {
      const input: Record<string, string> = {
        ...values,
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
      return mutate(
        latestDatabase(),
        "foodiva",
        "packingList",
        input,
        lotId,
        date,
      );
    });
    if (next) onSaved(next);
  }

  return (
    <Dialog
      overline={`${date} · Foodiva · ${lot?.poId ?? ""}`}
      title={titles.packingList}
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
          </Notice>
          <FormGrid>
            <FormField label="เลข Invoice">
              <Input
                type="text"
                value={values.invoiceNo}
                onChange={(event) => set("invoiceNo", event.target.value)}
              />
            </FormField>
            <FormField label="รายการสินค้า">
              <Input
                type="text"
                value={values.product}
                onChange={(event) => set("product", event.target.value)}
              />
            </FormField>
            <FormField label="CODE สินค้า" optional>
              <Input
                type="text"
                value={values.code}
                onChange={(event) => set("code", event.target.value)}
              />
            </FormField>
            <FormField
              label="Inv. Weight (กก.)"
              optional
              hint="ใส่ไว้เพื่อให้ระบบคิด Sliced Weight Lost ให้"
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                value={values.invWeightKg}
                onChange={(event) => set("invWeightKg", event.target.value)}
              />
            </FormField>
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
              invWeight: Number(values.invWeightKg) || undefined,
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
              : "บันทึก Packing List"
          }
        />
      </DialogForm>
    </Dialog>
  );
}
