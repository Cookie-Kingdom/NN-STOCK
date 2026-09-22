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
import type { PrefillSource } from "@/lib/prefill";
import {
  branches,
  centralStock,
  entries,
  mutate,
  n,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const typed = (kg: Record<string, string>) =>
  branches.filter((name) => (kg[name] || "").trim() && Number(kg[name]) !== 0);

const byLastRatio: PrefillSource = { label: "ตามสัดส่วนครั้งก่อน" };

/** `stock` split between the branches in the proportion of the last allocation (the
 *  allocates saved together with the latest one: same lot, same day). The last branch
 *  takes what rounding leaves, so the split adds up to the stock exactly. Empty when
 *  nothing was allocated before or there is no stock. */
function splitByLastRatio(db: Database, stock: number) {
  const all = entries(db, "allocate");
  const last = all.at(-1);
  if (!last || stock <= 0) return {};
  const round = all.filter(
    (entry) => entry.lotId === last.lotId && entry.date === last.date,
  );
  const share = (branch: string) =>
    round
      .filter((entry) => entry.values.branch === branch)
      .reduce((sum, entry) => sum + n(entry.values, "kg"), 0);
  const total = branches.reduce((sum, branch) => sum + share(branch), 0);
  if (total <= 0) return {};
  const shared = branches.filter((branch) => share(branch) > 0);
  const kg: Record<string, string> = {};
  let given = 0;
  for (const [index, branch] of shared.entries()) {
    const value =
      index === shared.length - 1
        ? +(stock - given).toFixed(6)
        : Math.round(((stock * share(branch)) / total) * 100) / 100;
    kg[branch] = String(value);
    given += value;
  }
  return kg;
}

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
      `น้ำหนักรวม ${fmt(total)} กก. เกินสต๊อกกลาง · กรอกได้สูงสุด ${fmt(stock)} กก.`,
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
  const [kg, setKg] = useState<Record<string, string>>(() =>
    splitByLastRatio(db, stock),
  );
  /** Branches still holding the split the form opened with; an edit drops one. */
  const [prefilled, setPrefilled] = useState(() => new Set(Object.keys(kg)));
  const own = (branch: string) =>
    setPrefilled((current) => {
      const next = new Set(current);
      next.delete(branch);
      return next;
    });
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
    own(branch);
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
                prefilled={prefilled.has(name) ? byLastRatio : undefined}
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
                  onChange={(event) => {
                    setKg((current) => ({
                      ...current,
                      [name]: event.target.value,
                    }));
                    own(name);
                  }}
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
