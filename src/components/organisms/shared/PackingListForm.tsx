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
import { usePrefill } from "@/components/organisms/shared/usePrefill";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { saveAttachment } from "@/lib/attachment-store";
import { fmt } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import { lastLabel, lastValue, type Prefill } from "@/lib/prefill";
import {
  entries,
  mutate,
  shipmentLines,
  titles,
  type Database,
  type Values,
} from "@/lib/store";

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/** Two decimals like the fields, so float noise never shows. */
const round2 = (kg: number) => Math.round(kg * 100) / 100;

/**
 * Foodiva's own Packing List, kept apart from the transport document. There are too many
 * boxes to type one by one, so the file itself is the evidence Chef House looks at and
 * only the totals are typed:
 * - **Inv. Weight** is the kg this shipment's Request asked for from its purchase
 *   PO(s), shown read-only. Change it by changing the Request.
 * - **Sliced Weight Net** is the total kg sent, typed. Over Inv. Weight is a warning.
 * - **Sliced Weight Lost** is the gap between the two, always positive. Zero is a
 *   normal list.
 *
 * Nothing here blocks the save: a blank total, invoice, product or file is saved and
 * marked "ยังไม่ได้กรอก" (GEN-02). The box count may be left out.
 *
 * With `onDraft` nothing is saved here: the values (file already uploaded) go back to
 * FoodivaDispatchForm, which saves them together with the transport document.
 */
export function PackingListForm({
  db,
  lotId,
  date,
  onDate,
  onClose,
  onSaved,
  draft,
  onDraft,
}: {
  db: Database;
  lotId: string;
  date: string;
  onDate: (date: string) => void;
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
      slicedNetKg: saved?.values.slicedNetKg ?? "",
      boxCount: saved?.values.boxCount ?? "",
    };
    const product =
      saved?.values.product ??
      db.lots.find((l) => l.id === pos[0])?.values.productName ??
      "";
    return { base, prefill: prefillFor(product) };
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState(saved?.values.attachment ?? "");
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");

  const slicedNet = round2(Number(values.slicedNetKg) || 0);
  /** Sliced Weight Lost is not typed — it is what cutting took away, the gap between
   *  Inv. Weight and Sliced Weight Net, as a plain number that is never negative. */
  const slicedLost =
    invWeight && values.slicedNetKg.trim()
      ? round2(Math.abs(invWeight - slicedNet))
      : 0;
  /** SHP-02: still editable after the Owner's smoke PO, but the PO was sized on the old list. */
  const afterSmokeOrder =
    !onDraft && lotId && entries(db, "smokeOrder", lotId).length > 0;
  /** The same warning mutate() gives, said as the total is typed. Only a warning: the
   *  meat Foodiva cut is what it is, and the list still saves. */
  const overInvWeight =
    invWeight && slicedNet > invWeight + 0.001
      ? `Sliced Weight Net เกิน Inv. Weight · รวมได้สูงสุด ${fmt(invWeight)} กก.`
      : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const collect = async () => {
      const input: Values = {
        ...values,
        // Not typed: Inv. Weight is the Request's kg, Lost is the gap it leaves.
        invWeightKg: invWeight ? String(invWeight) : "",
        slicedLostKg: String(slicedLost),
      };
      if (file) {
        input.attachment = file.name;
        input.attachmentStorageKey = await saveAttachment(file, "packingList");
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
        "owner",
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
      onClose={onClose}
    >
      <DialogForm noValidate onSubmit={submit}>
        <DialogBody>
          <WorkingDateField asField date={date} onDate={onDate} />
          {afterSmokeOrder && (
            <Notice tone="warning">
              Owner ออก PO รมควันของชุดนี้แล้ว · แก้ Packing List ได้ แต่ควรแจ้ง
              Owner ให้ตรวจน้ำหนัก PO รมควันอีกครั้ง
            </Notice>
          )}
          <Notice>
            แนบไฟล์ Packing List ของ Foodiva ไว้ให้ Chef House เปิดดู
            แล้วกรอกเฉพาะน้ำหนักส่งรวม ไม่ต้องกรอกรายกล่องรับเข้า ·
            ช่องที่เว้นว่างบันทึกได้ ระบบจะขึ้นว่า “ยังไม่ได้กรอก”
          </Notice>
          <FormGrid>
            <FileUploadField
              label="แนบไฟล์ Packing List"
              wide
              accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.heic,.heif"
              maxBytes={MAX_ATTACHMENT_BYTES}
              oversizeMessage="ไฟล์ Packing List ต้องมีขนาดไม่เกิน 2 MB"
              hint="Chef House ใช้ไฟล์นี้ตรวจรายกล่องรับเข้าตอนรับของ · ไม่เกิน 2 MB"
              onError={setError}
              onFile={(picked) => {
                setFile(picked);
                setFileName(picked?.name ?? "");
              }}
              fileName={fileName}
            />
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
            <FormField label="จำนวนกล่องรับเข้า" optional>
              <Input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={values.boxCount}
                onChange={(event) => set("boxCount", event.target.value)}
              />
            </FormField>
            <FormField
              label="น้ำหนักส่งรวม · Sliced Weight Net (กก.)"
              hint="น้ำหนักเนื้อที่ใช้ได้หลังตัด รวมทุกกล่องรับเข้าตามไฟล์"
            >
              <Input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={values.slicedNetKg}
                onChange={(event) => set("slicedNetKg", event.target.value)}
              />
            </FormField>
            {/* Not a field: Inv. Weight belongs to the Owner's Request. */}
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
            {/* Not a field: the figure is derived from the two above. */}
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
          </FormGrid>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          warning={overInvWeight}
          onCancel={onClose}
          submitLabel={
            onDraft ? "ใส่ Packing List ในใบขนส่ง" : "บันทึก Packing List"
          }
        />
      </DialogForm>
    </Dialog>
  );
}
