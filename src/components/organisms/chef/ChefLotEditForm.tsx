"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { timeOptions } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  entries,
  mutate,
  n,
  packWeights,
  type Database,
  type Values,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";

export function ChefLotEditForm({
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
  const received = entries(db, "cmReceive", lotId).at(-1);
  const prepared = entries(db, "prepare", lotId).at(-1);
  const smokeEntries = entries(db, "smoke", lotId);
  const [values, setValues] = useState<Values>(() => ({
    arrival: received?.values.arrival || "",
    preSmokeKg: prepared?.values.preSmokeKg || "",
  }));
  const [smokeDrafts, setSmokeDrafts] = useState(() =>
    smokeEntries.map((entry) => ({
      id: entry.id,
      smokeDate: entry.values.smokeDate || entry.date,
      inputKg: entry.values.inputKg || "",
      wasteKg: entry.values.wasteKg || "0",
      packs: packWeights(entry.values.packs).join("\n"),
    })),
  );
  const { error, setError, run, saving } = useSaveMutation("แก้ไขไม่สำเร็จ");
  const complete =
    [values.arrival, values.preSmokeKg].every((value) =>
      String(value ?? "").trim(),
    ) &&
    smokeDrafts.every(
      (draft) =>
        draft.smokeDate &&
        draft.inputKg.trim() &&
        draft.wasteKg.trim() &&
        draft.packs.trim(),
    );
  /* The save's own mutate, run on the values as they stand, so a weight over the
   * one received or a round that does not balance shows while it is being typed
   * instead of after บันทึก. mutate clones the database, so a dry run changes
   * nothing. Held back until every control has something in it: an unfinished
   * form must not be told off for being unfinished. */
  const liveError = useMemo(() => {
    if (!complete) return "";
    try {
      mutate(
        db,
        "cm",
        "chefEdit",
        { ...values, batches: JSON.stringify(smokeDrafts) },
        lotId,
        date,
      );
      return "";
    } catch (caught) {
      return caught instanceof Error ? caught.message : "";
    }
  }, [complete, db, values, smokeDrafts, lotId, date]);
  if (!lot || !received || !prepared || !smokeEntries.length) return null;
  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const setSmoke = (
    id: string,
    key: "smokeDate" | "inputKg" | "wasteKg" | "packs",
    value: string,
  ) => {
    setSmokeDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, [key]: value } : draft,
      ),
    );
    setError("");
  };
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      mutate(
        latestDatabase(),
        "cm",
        "chefEdit",
        { ...values, batches: JSON.stringify(smokeDrafts) },
        lotId,
        date,
      ),
    );
    if (saved) onSaved();
  }
  const smokeTotal = smokeDrafts.reduce(
    (total, draft) => total + (Number(draft.inputKg) || 0),
    0,
  );
  const preSmokeKgValue = Number(values.preSmokeKg) || 0;
  const balanced = Math.abs(smokeTotal - preSmokeKgValue) < 0.001;
  return (
    <Dialog
      overline={`Chef House · ${lot.id}`}
      title="Edit ข้อมูลก่อนปิด Lot"
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
            แก้ไขได้เฉพาะก่อนยืนยันปิด Lot
            เมื่อปิดแล้วข้อมูลจะเป็นอ่านอย่างเดียว · น้ำหนักรับจริง{" "}
            {fmt(n(lot.values, "receivedKg"))} กก. (ช่องเหลือง)
            บันทึกครั้งเดียวตอนยืนยันรับเนื้อ แก้ไขไม่ได้
          </Notice>
          <FormGrid>
            <FormField label="เวลารับ">
              <Select
                value={values.arrival}
                onChange={(event) => set("arrival", event.target.value)}
              >
                <option value="">เลือกเวลา</option>
                {timeOptions(values.arrival).map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="น้ำหนักก่อนสโมค (กก.)">
              <Input
                type="number"
                min="0.001"
                step="0.001"
                inputMode="decimal"
                value={values.preSmokeKg}
                onChange={(event) => set("preSmokeKg", event.target.value)}
              />
            </FormField>
          </FormGrid>
          <DataTable
            title="ตรวจสอบและแก้ไข Log Lot สโมครายวัน"
            columns={[
              "วันที่",
              "Lot สโมค",
              "น้ำหนักเข้าเตา",
              "น้ำหนัก Waste",
              "น้ำหนักกล่องรมควัน (กก. / 1 บรรทัดต่อกล่องรมควัน)",
            ]}
            rowKeys={smokeDrafts.map((draft) => draft.id)}
            rows={smokeDrafts.map((draft, index) => [
              <Input
                key={`${draft.id}-date`}
                variant="table"
                type="date"
                max={today()}
                aria-label={`วันที่สโมค รอบ ${index + 1}`}
                value={draft.smokeDate}
                onChange={(event) =>
                  setSmoke(draft.id, "smokeDate", event.target.value)
                }
              />,
              smokeEntries[index]?.values.subLot || "—",
              <Input
                key={`${draft.id}-input`}
                variant="table"
                type="number"
                min="0.001"
                step="0.001"
                inputMode="decimal"
                aria-label={`น้ำหนักเข้าเตา รอบ ${index + 1}`}
                value={draft.inputKg}
                onChange={(event) =>
                  setSmoke(draft.id, "inputKg", event.target.value)
                }
              />,
              <Input
                key={`${draft.id}-waste`}
                variant="table"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                aria-label={`น้ำหนัก Waste รอบ ${index + 1}`}
                value={draft.wasteKg}
                onChange={(event) =>
                  setSmoke(draft.id, "wasteKg", event.target.value)
                }
              />,
              <Textarea
                key={`${draft.id}-packs`}
                variant="table"
                rows={3}
                aria-label={`น้ำหนักกล่องรมควัน รอบ ${index + 1}`}
                value={draft.packs}
                onChange={(event) =>
                  setSmoke(draft.id, "packs", event.target.value)
                }
              />,
            ])}
          />
          <Notice tone={balanced ? "success" : "warning"} role="none">
            น้ำหนักเข้าเตารวมจาก Log {fmt(smokeTotal)} กก. · น้ำหนักก่อนสโมค{" "}
            {fmt(preSmokeKgValue)} กก. ·{" "}
            {balanced
              ? "ยอดตรงกัน พร้อมปิด Lot"
              : "ยอดยังไม่ตรง ต้องปรับ Log หรือ น้ำหนักก่อนสโมคก่อนปิด Lot"}
          </Notice>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={liveError}
          onCancel={onClose}
          submitLabel="บันทึกการแก้ไข"
        />
      </DialogForm>
    </Dialog>
  );
}
