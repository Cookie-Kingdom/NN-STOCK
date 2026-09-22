"use client";

import { useState } from "react";
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
import { PackingListTable } from "@/components/organisms/shared/PackingListTable";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import {
  packingListView,
  receivedDraft,
  receivedValue,
} from "@/components/organisms/chef/receivedBoxes";
import { timeOptions } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  latestPackingList,
  mutate,
  OverStockError,
  titles,
  type Database,
} from "@/lib/store";

/**
 * Chef House weighs in a shipment: the latest Packing List with only the yellow
 * cells editable, plus the arrival time. A total off the Packing List saves without
 * complaint — it is the weight stock and cost run on.
 */
export function ChefReceiveForm({
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
  onSaved: () => void;
}) {
  const lot = db.lots.find((item) => item.id === lotId);
  const list = latestPackingList(db, lotId);
  const [arrival, setArrival] = useState("");
  const [received, setReceived] = useState(() => receivedDraft(list));
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  if (!lot || !list) return null;
  const view = packingListView(list, received);
  const missing = received.filter((kg) => kg === undefined).length;
  const input = { arrival, receivedBoxes: receivedValue(received) };
  /* The save's own mutate as a dry run (mutate clones, so it changes nothing), so a
   * refusal shows while the boxes are typed. Held back until the time and every box
   * are in, except an over-stock amount, which is wrong already. */
  let liveError = "";
  try {
    mutate(db, "cm", "cmReceive", input, lotId, date);
  } catch (caught) {
    if ((arrival && !missing) || caught instanceof OverStockError)
      liveError = caught instanceof Error ? caught.message : "";
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      mutate(latestDatabase(), "cm", "cmReceive", input, lotId, date),
    );
    if (saved) onSaved();
  }

  return (
    <Dialog
      overline={`${date} · Chef House · ${lot.poId}`}
      title={titles.cmReceive}
      size="wide"
      onClose={onClose}
    >
      <DialogForm noValidate onSubmit={save}>
        <DialogBody>
          <WorkingDateField
            asField
            date={date}
            onDate={onDate}
            minDate={minDate}
          />
          <Notice>
            ชั่งทีละกล่องรับเข้าแล้วกรอกน้ำหนักจริงในช่องสีเหลือง ช่องของ
            Foodiva แก้ไม่ได้ ใส่ 0 ถ้าไม่ได้รับกล่องนั้น ยอดไม่ตรงกับ Packing
            List ก็บันทึกได้ และแก้ได้จนกว่าจะยืนยันปิด Lot
          </Notice>
          <FormGrid>
            <FormField label="เวลาที่รถมาถึง">
              <Select
                value={arrival}
                onChange={(event) => {
                  setArrival(event.target.value);
                  setError("");
                }}
              >
                <option value="">เลือกเวลา</option>
                {timeOptions(arrival).map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </Select>
            </FormField>
          </FormGrid>
          <PackingListTable
            {...view}
            onReceived={(no, kg) => {
              setReceived((current) =>
                current.map((value, i) => (i === no - 1 ? kg : value)),
              );
              setError("");
            }}
          />
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={liveError}
          hint={
            missing
              ? `ยังไม่ได้กรอก ${missing} กล่องรับเข้า`
              : "ยอดรวมช่องเหลืองจะใช้ตัดสต๊อกและคิดต้นทุน"
          }
          onCancel={onClose}
          submitLabel="ยืนยันรับเนื้อ"
        />
      </DialogForm>
    </Dialog>
  );
}
