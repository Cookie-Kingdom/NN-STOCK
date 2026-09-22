"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { ReadRow } from "@/components/atoms/ReadRow";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import { branches, centralStock, mutate, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

const typed = (kg: Record<string, string>) =>
  branches.filter((name) => (kg[name] || "").trim() && Number(kg[name]) !== 0);

/** One allocate per branch with kg typed, built from the inputs as they stand. Shared
 *  by the save and the live check so both refuse for the same reason. */
function buildAllocation(
  from: Database,
  kg: Record<string, string>,
  lotId: string,
  date: string,
) {
  const names = typed(kg);
  if (!names.length) throw new Error("กรอกน้ำหนักจัดสรรอย่างน้อย 1 สาขา");
  const stock = centralStock(from, lotId);
  const total = names.reduce((sum, name) => sum + Number(kg[name]), 0);
  if (total > stock + 0.001)
    throw new Error(
      `น้ำหนักรวม ${fmt(total)} กก. เกินสต๊อกกลาง ${fmt(stock)} กก.`,
    );
  let next = from;
  for (const branch of names)
    next = mutate(
      next,
      "owner",
      "allocate",
      { branch, kg: kg[branch], deliveryDate: date },
      lotId,
      date,
    );
  return next;
}

export function AllocationForm({
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
  /** Gets the summary, e.g. "ศาลาแดง 500.00 กก. · มีนบุรี 200.00 กก.". */
  onSaved: (summary: string) => void;
}) {
  const stock = centralStock(db, lotId);
  const [kg, setKg] = useState<Record<string, string>>({});
  const { error, run, saving } = useSaveMutation("จัดสรรไม่สำเร็จ");
  const total = typed(kg).reduce((sum, name) => sum + Number(kg[name]), 0);
  const remaining = stock - total;
  /* mutate clones the database, so the dry run changes nothing. Held back until a kg
   * is typed: an untouched form must not be told off for being untouched. */
  const liveError = useMemo(() => {
    if (!Object.values(kg).some((value) => value.trim())) return "";
    try {
      buildAllocation(db, kg, lotId, date);
      return "";
    } catch (caught) {
      return caught instanceof Error ? caught.message : "";
    }
  }, [db, kg, lotId, date]);
  /** Everything the other branches leave, unrounded, so the lot can drain to exactly 0. */
  function fillRest(branch: string) {
    const others = typed(kg)
      .filter((name) => name !== branch)
      .reduce((sum, name) => sum + Number(kg[name]), 0);
    const rest = Math.max(0, +(stock - others).toFixed(6));
    setKg((current) => ({ ...current, [branch]: String(rest) }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      buildAllocation(latestDatabase(), kg, lotId, date),
    );
    if (saved)
      onSaved(
        typed(kg)
          .map((name) => `${name} ${fmt(Number(kg[name]))} กก.`)
          .join(" · "),
      );
  }
  return (
    <Dialog overline={lotId} title="จัดสรรเนื้อไปสาขา (กก.)" onClose={onClose}>
      <DialogForm onSubmit={submit}>
        <DialogBody>
          <WorkingDateField
            asField
            date={date}
            onDate={onDate}
            minDate={minDate}
          />
          <ReadRow label="สต๊อกกลางของ Lot นี้" value={`${fmt(stock)} กก.`} />
          <FormGrid>
            {branches.map((name) => (
              <FormField
                key={name}
                label={`${name} (กก.)`}
                hint={
                  <Button
                    type="button"
                    variant="text"
                    onClick={() => fillRest(name)}
                  >
                    ที่เหลือทั้งหมด
                  </Button>
                }
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0.00"
                  value={kg[name] || ""}
                  onChange={(event) =>
                    setKg((current) => ({
                      ...current,
                      [name]: event.target.value,
                    }))
                  }
                />
              </FormField>
            ))}
          </FormGrid>
          <ReadRow
            label="คงเหลือในคลังกลางหลังจัดสรร"
            value={`${fmt(Math.abs(remaining) < 0.001 ? 0 : remaining)} กก.`}
            className={remaining < -0.001 ? "text-danger" : undefined}
          />
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={liveError}
          hint="กรอกน้ำหนักให้ทั้งสองสาขาได้ในครั้งเดียว"
          onCancel={onClose}
          submitLabel="บันทึกการจัดสรร"
        />
      </DialogForm>
    </Dialog>
  );
}
