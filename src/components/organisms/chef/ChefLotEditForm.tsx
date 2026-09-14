"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { Textarea } from "@/components/atoms/Textarea";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { Notice } from "@/components/molecules/Notice";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import { entries, n, type Database, type Values } from "@/lib/store";
import { fmt } from "@/lib/format";

export function ChefLotEditForm({
  db,
  lotId,
  onClose,
  onSaved,
}: {
  db: Database;
  lotId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const lot = db.lots.find((item) => item.id === lotId);
  const received = entries(db, "cmReceive", lotId).at(-1);
  const prepared = entries(db, "prepare", lotId).at(-1);
  const smokeEntries = entries(db, "smoke", lotId);
  const [values, setValues] = useState<Values>(() => ({
    receivedKg: received?.values.receivedKg || "",
    arrival: received?.values.arrival || "",
    preKg: prepared?.values.preKg || "",
  }));
  const [smokeDrafts, setSmokeDrafts] = useState(() =>
    smokeEntries.map((entry) => ({
      id: entry.id,
      smokeDate: entry.values.smokeDate || entry.date,
      inputKg: entry.values.inputKg || "",
      wasteKg: entry.values.wasteKg || "0",
      packs: (entry.values.packs || "").split(/[\s,]+/).filter(Boolean).join("\n"),
    })),
  );
  const { error, setError, run } = useSaveMutation("แก้ไขไม่สำเร็จ");
  if (!lot || !received || !prepared || !smokeEntries.length)
    return null;
  const receivedRecord = received;
  const preparedRecord = prepared;
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
  // Edits the latest entries in place rather than going through mutate(); kept as-is (separate domain card).
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() => {
      const next = latestDatabase();
      const nextLot = next.lots.find((item) => item.id === lotId);
      const receiveEntry = next.entries.find((entry) => entry.id === receivedRecord.id);
      const prepareEntry = next.entries.find((entry) => entry.id === preparedRecord.id);
      const smokeRecords = smokeDrafts.map((draft) =>
        next.entries.find((entry) => entry.id === draft.id),
      );
      if (!nextLot || !receiveEntry || !prepareEntry || smokeRecords.some((entry) => !entry))
        throw new Error("ไม่พบข้อมูล Lot ล่าสุด");
      const receivedKg = Number(values.receivedKg);
      const preKg = Number(values.preKg);
      if (![receivedKg, preKg].every(Number.isFinite) || receivedKg <= 0 || preKg <= 0)
        throw new Error("กรอกน้ำหนักให้ถูกต้อง");
      if (!values.arrival || !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.arrival))
        throw new Error("กรอกเวลารับเป็น HH:mm");
      if (receivedKg > n(nextLot.values, "dispatchKg") + 0.001)
        throw new Error("น้ำหนักรับจริงมากกว่าน้ำหนักที่ส่ง");
      if (preKg > receivedKg + 0.001)
        throw new Error("น้ำหนักก่อนสโมคมากกว่าน้ำหนักรับจริง");
      const revisedBatches = smokeDrafts.map((draft) => {
        const inputKg = Number(draft.inputKg);
        const wasteKg = Number(draft.wasteKg);
        const weights = draft.packs.split(/[\s,]+/).filter(Boolean).map(Number);
        if (!draft.smokeDate || !Number.isFinite(inputKg) || !Number.isFinite(wasteKg) || inputKg <= 0 || wasteKg < 0)
          throw new Error("กรอกวันที่ น้ำหนักเข้าเตา และ Waste ให้ครบทุกรอบ");
        if (!weights.length || weights.some((weight) => !Number.isFinite(weight) || weight <= 0))
          throw new Error("กรอกน้ำหนักถุงใหญ่ให้ครบและมากกว่า 0 ทุกรอบ");
        const outputKg = weights.reduce((sum, weight) => sum + weight, 0);
        if (Math.abs(outputKg + wasteKg - inputKg) > 0.001)
          throw new Error("น้ำหนักถุงรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา");
        return { ...draft, inputKg, wasteKg, weights, outputKg };
      });
      const totalInputKg = revisedBatches.reduce((total, batch) => total + batch.inputKg, 0);
      if (Math.abs(totalInputKg - preKg) > 0.001)
        throw new Error("ก่อนปิด Lot น้ำหนักเข้าเตารวมจาก Log ต้องเท่ากับน้ำหนักก่อนสโมค");
      receiveEntry.values = { ...receiveEntry.values, receivedKg: String(receivedKg), arrival: values.arrival };
      prepareEntry.values = { ...prepareEntry.values, preKg: String(preKg) };
      revisedBatches.forEach((batch, index) => {
        const smokeEntry = smokeRecords[index]!;
        smokeEntry.values = {
          ...smokeEntry.values,
          smokeDate: batch.smokeDate,
          inputKg: String(batch.inputKg),
          wasteKg: String(batch.wasteKg),
          packs: batch.weights.join("\n"),
          outputKg: batch.outputKg.toFixed(2),
          packCount: String(batch.weights.length),
        };
      });
      const latestBatch = revisedBatches.at(-1)!;
      nextLot.values = {
        ...nextLot.values,
        receivedKg: String(receivedKg),
        arrival: values.arrival,
        preKg: String(preKg),
        inputKg: String(latestBatch.inputKg),
        wasteKg: String(latestBatch.wasteKg),
        packs: latestBatch.weights.join("\n"),
        outputKg: latestBatch.outputKg.toFixed(2),
        packCount: String(latestBatch.weights.length),
      };
      return next;
    });
    if (saved) onSaved();
  }
  const smokeTotal = smokeDrafts.reduce(
    (total, draft) => total + (Number(draft.inputKg) || 0),
    0,
  );
  const preKgValue = Number(values.preKg) || 0;
  const balanced = Math.abs(smokeTotal - preKgValue) < 0.001;
  return (
    <Dialog overline={`Chef_house · ${lot.id}`} title="Edit ข้อมูลก่อนปิด Lot" onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={save}>
        <DialogBody>
          <Notice>แก้ไขได้เฉพาะก่อนยืนยันปิด Lot เมื่อปิดแล้วข้อมูลจะเป็นอ่านอย่างเดียว</Notice>
          <div className="my-4.5 grid grid-cols-2 gap-4.5 max-md:grid-cols-1 max-md:gap-4">
            <FormField label="น้ำหนักรับจริง (กก.)"><Input type="number" min="0.001" step="0.001" value={values.receivedKg} onChange={(event) => set("receivedKg", event.target.value)} /></FormField>
            <FormField label="เวลารับ (HH:mm)"><Input type="time" value={values.arrival} onChange={(event) => set("arrival", event.target.value)} /></FormField>
            <FormField label="น้ำหนักก่อนสโมค (กก.)"><Input type="number" min="0.001" step="0.001" value={values.preKg} onChange={(event) => set("preKg", event.target.value)} /></FormField>
          </div>
          <DataTable
            title="ตรวจสอบและแก้ไข Log Lot สโมครายวัน"
            columns={["วันที่", "Lot สโมค", "น้ำหนักเข้าเตา", "น้ำหนัก Waste", "น้ำหนักถุงใหญ่จาก Chef_house (กก. / 1 บรรทัดต่อถุง)"]}
            rowKeys={smokeDrafts.map((draft) => draft.id)}
            rows={smokeDrafts.map((draft, index) => [
              <Input key={`${draft.id}-date`} variant="table" type="date" aria-label={`วันที่สโมค รอบ ${index + 1}`} value={draft.smokeDate} onChange={(event) => setSmoke(draft.id, "smokeDate", event.target.value)} />,
              smokeEntries[index]?.values.subLot || "—",
              <Input key={`${draft.id}-input`} variant="table" type="number" min="0.001" step="0.001" aria-label={`น้ำหนักเข้าเตา รอบ ${index + 1}`} value={draft.inputKg} onChange={(event) => setSmoke(draft.id, "inputKg", event.target.value)} />,
              <Input key={`${draft.id}-waste`} variant="table" type="number" min="0" step="0.001" aria-label={`น้ำหนัก Waste รอบ ${index + 1}`} value={draft.wasteKg} onChange={(event) => setSmoke(draft.id, "wasteKg", event.target.value)} />,
              <Textarea key={`${draft.id}-packs`} variant="table" rows={3} aria-label={`น้ำหนักถุงใหญ่ รอบ ${index + 1}`} value={draft.packs} onChange={(event) => setSmoke(draft.id, "packs", event.target.value)} />,
            ])}
          />
          <Notice tone={balanced ? "success" : "warning"} role="none">
            น้ำหนักเข้าเตารวมจาก Log {fmt(smokeTotal)} กก. · น้ำหนักก่อนสโมค {fmt(preKgValue)} กก. · {balanced ? "ยอดตรงกัน พร้อมปิด Lot" : "ยอดยังไม่ตรง ต้องปรับ Log หรือ น้ำหนักก่อนสโมคก่อนปิด Lot"}
          </Notice>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter onCancel={onClose} submitLabel="บันทึกการแก้ไข" />
      </form>
    </Dialog>
  );
}
