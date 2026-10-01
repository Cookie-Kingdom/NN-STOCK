"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { PackingListSummary } from "@/components/organisms/shared/PackingListSummary";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { currentTimeSlot, timeOptions } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  latestPackingList,
  mutate,
  check,
  titles,
  type Database,
} from "@/lib/store";

/**
 * Chef House weighs in a shipment: the arrival time and the total kg received. The
 * latest Packing List (its file and Foodiva's sent total) sits above for reference. A
 * total off the Packing List saves with a warning — it is the weight stock and cost
 * run on.
 *
 * CHF-01/07: no Packing List on file (or `lotId === ""`, which opens a new batch) is
 * no reason to wait: Chef House types the total it weighed.
 */
export function ChefReceiveForm({
  db,
  lotId,
  date,
  onDate,
  onClose,
  onSaved,
}: {
  db: Database;
  lotId: string;
  date: string;
  onDate: (date: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const lot = db.lots.find((item) => item.id === lotId);
  const list = latestPackingList(db, lotId);
  // The truck is usually weighed in as it arrives, so the time starts at now.
  const [arrival, setArrival] = useState(() => currentTimeSlot());
  const [arrivalTouched, setArrivalTouched] = useState(false);
  const [receivedKg, setReceivedKg] = useState("");
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  // A lot gone from view; "" is a new batch, not a missing one.
  if (lotId && !lot) return null;
  const input = { arrival, receivedKg };
  /* The save's own mutate as a dry run (mutate clones, so it changes nothing), so a
   * refusal or warning shows while the total is typed. A warning never blocks the save. */
  const live = check(() =>
    mutate(db, "owner", "cmReceive", input, lotId, date),
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      mutate(latestDatabase(), "owner", "cmReceive", input, lotId, date),
    );
    if (saved) onSaved();
  }

  return (
    <Dialog
      overline={`${date} · Chef House · ${lot ? lot.poId : "ชุดใหม่"}`}
      title={titles.cmReceive}
      onClose={onClose}
    >
      <DialogForm noValidate onSubmit={save}>
        <DialogBody>
          <WorkingDateField asField date={date} onDate={onDate} />
          {list ? (
            <>
              <Notice>
                เปิดไฟล์ Packing List ของ Foodiva เพื่อตรวจรายกล่องรับเข้า
                แล้วกรอกน้ำหนักรับรวมที่ชั่งได้จริง ยอดไม่ตรงกับ Packing List
                ก็บันทึกได้ และแก้ภายหลังได้ที่ Log
              </Notice>
              <PackingListSummary values={list.values} />
            </>
          ) : (
            <Notice tone="warning">
              {lot
                ? "ชุดนี้ยังไม่มี Packing List จาก Foodiva"
                : "เปิดชุดใหม่ ระบบออกเลขที่การส่งให้เมื่อบันทึก"}{" "}
              · กรอกน้ำหนักรับรวมที่ชั่งได้ บันทึกได้เลยโดยไม่ต้องรอ Packing
              List หรือ PO รมควัน
            </Notice>
          )}
          <FormGrid>
            <FormField
              label="เวลาที่รถมาถึง"
              prefilled={
                arrivalTouched || !arrival
                  ? undefined
                  : { label: "เวลาปัจจุบัน" }
              }
            >
              <Select
                value={arrival}
                onChange={(event) => {
                  setArrival(event.target.value);
                  setArrivalTouched(true);
                  setError("");
                }}
              >
                <option value="">เลือกเวลา</option>
                {timeOptions(arrival).map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="น้ำหนักรับรวม (กก.)"
              hint="ยอดนี้ใช้ตัดสต๊อกและคิดต้นทุน"
            >
              <Input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={receivedKg}
                onChange={(event) => {
                  setReceivedKg(event.target.value);
                  setError("");
                }}
              />
            </FormField>
          </FormGrid>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={live.error}
          warning={live.warnings}
          onCancel={onClose}
          submitLabel="ยืนยันรับเนื้อ"
        />
      </DialogForm>
    </Dialog>
  );
}
