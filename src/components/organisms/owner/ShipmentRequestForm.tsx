"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Textarea } from "@/components/atoms/Textarea";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import { fmt } from "@/lib/format";
import {
  drawnKg,
  entries,
  mutate,
  poRemainingKg,
  purchaseLots,
  readyForChefHouse,
  type Database,
} from "@/lib/store";

/**
 * Owner's Request to send meat to Chef House: several purchase POs, a different kg from
 * each. Only POs with kg left are listed, each showing what it still has, so the Owner
 * sees the remaining while choosing; whatever is not asked for stays for the next Request.
 */
export function ShipmentRequestForm({
  db,
  date,
  onDate,
  minDate,
  onClose,
  onSaved,
}: {
  db: Database;
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
  onClose: () => void;
  onSaved: (next: Database) => void;
}) {
  const pos = purchaseLots(db).filter(
    (lot) => poRemainingKg(db, lot.id) > 0.001,
  );
  const [kg, setKg] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const { error, run, saving } = useSaveMutation("สร้าง Request ไม่สำเร็จ");
  const input = {
    lines: JSON.stringify(
      pos
        .filter((lot) => kg[lot.id]?.trim())
        .map((lot) => ({ lotId: lot.id, kg: kg[lot.id].trim() })),
    ),
    note,
  };
  const total = pos.reduce((sum, lot) => sum + (Number(kg[lot.id]) || 0), 0);
  // The save's own mutate as a dry run (mutate clones), held back until a kg is typed.
  let liveError = "";
  if (Object.values(kg).some((value) => value.trim())) {
    try {
      mutate(db, "owner", "shipmentRequest", input, "", date);
    } catch (caught) {
      liveError = caught instanceof Error ? caught.message : "";
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      mutate(latestDatabase(), "owner", "shipmentRequest", input, "", date),
    );
    if (saved) onSaved(saved);
  }
  return (
    <Dialog
      overline="Request ส่งเนื้อไป Chef House"
      title="สร้าง Request ส่งเนื้อไป Chef House"
      size="wide"
      onClose={onClose}
    >
      <DialogForm onSubmit={submit}>
        <DialogBody>
          <WorkingDateField
            asField
            date={date}
            onDate={onDate}
            minDate={minDate}
          />
          <DataTable
            title="เลือก PO ซื้อและน้ำหนักที่จะส่งเที่ยวนี้"
            columns={[
              "เลข PO",
              "Invoice",
              "พร้อมส่ง",
              "ส่งไปแล้ว",
              "คงเหลือ",
              "ส่งเที่ยวนี้ (กก.)",
            ]}
            emptyText="ไม่มี PO ซื้อที่มีเนื้อคงเหลือให้ส่ง (ต้องมี Invoice เนื้อจาก Foodiva ก่อน)"
            rowKeys={pos.map((lot) => lot.id)}
            rows={pos.map((lot) => [
              <strong key="po">{lot.poId}</strong>,
              entries(db, "foodivaConfirm", lot.id).at(-1)?.values.invoiceNo ||
                "-",
              `${fmt(readyForChefHouse(db, lot.id))} กก.`,
              `${fmt(drawnKg(db, lot.id))} กก.`,
              <strong key="remaining">
                {fmt(poRemainingKg(db, lot.id))} กก.
              </strong>,
              <Input
                key="kg"
                variant="table"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-label={`น้ำหนักที่จะส่งของ ${lot.poId}`}
                placeholder="0"
                value={kg[lot.id] || ""}
                onChange={(event) =>
                  setKg((current) => ({
                    ...current,
                    [lot.id]: event.target.value,
                  }))
                }
              />,
            ])}
          />
          <FormField label="หมายเหตุ" optional>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={liveError}
          hint={`รวมเที่ยวนี้ ${fmt(total)} กก. · ส่วนที่ไม่ได้ส่งยังคงเหลือไว้ส่งรอบหน้า`}
          onCancel={onClose}
          submitLabel="สร้าง Request"
        />
      </DialogForm>
    </Dialog>
  );
}
