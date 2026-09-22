"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Textarea } from "@/components/atoms/Textarea";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField, PrefillCaption } from "@/components/molecules/FormField";
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
  shipmentLines,
  titles,
  type Database,
} from "@/lib/store";

/**
 * Owner's Request to send meat to Chef House: several purchase POs, a different kg from
 * each. Only POs with kg left are listed, each showing what it still has, so the Owner
 * sees the remaining while choosing; whatever is not asked for stays for the next Request.
 * With `lotId` it edits that Request instead (until Foodiva makes the manifest): its own
 * lines are pre-filled and count as still available to their POs. A new Request starts
 * with every PO's whole remaining kg, captioned, for the Owner to lower or clear.
 */
export function ShipmentRequestForm({
  db,
  lotId,
  date,
  onDate,
  minDate,
  onClose,
  onSaved,
}: {
  db: Database;
  /** The shipment whose Request is edited; omitted for a new Request. */
  lotId?: string;
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
  onClose: () => void;
  onSaved: (next: Database) => void;
}) {
  const editing = db.lots.find((lot) => lot.id === lotId);
  const own = editing ? shipmentLines(editing) : [];
  const ownKg = (poId: string) =>
    own
      .filter((line) => line.lotId === poId)
      .reduce((total, line) => total + line.kg, 0);
  const remaining = (poId: string) => poRemainingKg(db, poId) + ownKg(poId);
  const pos = purchaseLots(db).filter((lot) => remaining(lot.id) > 0.001);
  const [kg, setKg] = useState<Record<string, string>>(() =>
    editing
      ? Object.fromEntries(own.map((line) => [line.lotId, String(line.kg)]))
      : Object.fromEntries(
          pos.map((lot) => [lot.id, String(+remaining(lot.id).toFixed(6))]),
        ),
  );
  /** POs still holding the remaining kg a new Request opened with; an edit drops one. */
  const [prefilled, setPrefilled] = useState(
    () => new Set(editing ? [] : pos.map((lot) => lot.id)),
  );
  const [note, setNote] = useState(editing?.values.note || "");
  const kind = editing ? "shipmentRequestEdit" : "shipmentRequest";
  const { error, run, saving } = useSaveMutation(
    editing ? "แก้ไข Request ไม่สำเร็จ" : "สร้าง Request ไม่สำเร็จ",
  );
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
      mutate(db, "owner", kind, input, lotId || "", date);
    } catch (caught) {
      liveError = caught instanceof Error ? caught.message : "";
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      mutate(latestDatabase(), "owner", kind, input, lotId || "", date),
    );
    if (saved) onSaved(saved);
  }
  return (
    <Dialog
      overline={
        editing ? `Request ${editing.poId}` : "Request ส่งเนื้อไป Chef House"
      }
      title={editing ? titles.shipmentRequestEdit : titles.shipmentRequest}
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
              `${fmt(drawnKg(db, lot.id) - ownKg(lot.id))} กก.`,
              <strong key="remaining">{fmt(remaining(lot.id))} กก.</strong>,
              <div key="kg">
                <Input
                  variant="table"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  aria-label={`น้ำหนักที่จะส่งของ ${lot.poId}`}
                  placeholder="0"
                  prefilled={prefilled.has(lot.id) ? "auto" : undefined}
                  value={kg[lot.id] || ""}
                  onChange={(event) => {
                    setKg((current) => ({
                      ...current,
                      [lot.id]: event.target.value,
                    }));
                    setPrefilled((current) => {
                      const next = new Set(current);
                      next.delete(lot.id);
                      return next;
                    });
                  }}
                />
                {prefilled.has(lot.id) && (
                  <PrefillCaption label="ยอดคงเหลือ PO" />
                )}
              </div>,
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
          submitLabel={editing ? "บันทึกการแก้ไข Request" : "สร้าง Request"}
        />
      </DialogForm>
    </Dialog>
  );
}
