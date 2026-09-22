"use client";

import { useState } from "react";
import { Select } from "@/components/atoms/Select";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField, PrefillCaption } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { PackingListTable } from "@/components/organisms/shared/PackingListTable";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import {
  listedDraft,
  packingListView,
  receivedValue,
} from "@/components/organisms/chef/receivedBoxes";
import { currentTimeSlot, timeOptions } from "@/lib/forms";
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
  // The truck is usually weighed in as it arrives, so the time starts at now.
  const [arrival, setArrival] = useState(() => currentTimeSlot());
  const [arrivalTouched, setArrivalTouched] = useState(false);
  // Each yellow cell starts at its Packing List weight, marked until it is edited.
  const [received, setReceived] = useState(() => listedDraft(list));
  const [expected, setExpected] = useState(() =>
    listedDraft(list).map((kg) => kg !== undefined),
  );
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  if (!lot || !list) return null;
  const view = packingListView(list, received, expected);
  const unweighed = expected.filter(Boolean).length;
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
            ช่องสีเหลืองใส่น้ำหนักตาม Packing List ไว้ให้แล้ว
            ชั่งทีละกล่องรับเข้าแล้วแก้เป็นน้ำหนักจริง ช่องของ Foodiva แก้ไม่ได้
            ใส่ 0 ถ้าไม่ได้รับกล่องนั้น ยอดไม่ตรงกับ Packing List ก็บันทึกได้
            และแก้ได้จนกว่าจะยืนยันปิด Lot
          </Notice>
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
          </FormGrid>
          <PackingListTable
            {...view}
            onReceived={(no, kg) => {
              setReceived((current) =>
                current.map((value, i) => (i === no - 1 ? kg : value)),
              );
              setExpected((current) =>
                current.map((marked, i) => (i === no - 1 ? false : marked)),
              );
              setError("");
            }}
          />
          {unweighed > 0 && (
            <PrefillCaption
              label={`ช่องสีเหลือง ${unweighed} กล่อง ตาม Packing List`}
              expected
            />
          )}
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
