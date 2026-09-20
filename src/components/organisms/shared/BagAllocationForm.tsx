"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/atoms/Select";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import { availableBags, branches, mutate, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

/** One allocate per destination branch, built from the choices as they stand. Shared by
 *  the save and the live check so both refuse for the same reason. */
function buildAllocation(
  from: Database,
  bags: ReturnType<typeof availableBags>,
  destinations: Record<string, string>,
  lotId: string,
  date: string,
) {
  let next = from;
  let count = 0;
  for (const branchName of branches) {
    const selected = bags.filter((bag) => destinations[bag.id] === branchName);
    if (!selected.length) continue;
    next = mutate(
      next,
      "owner",
      "allocate",
      {
        branch: branchName,
        bagIds: selected.map((bag) => bag.id).join(","),
        deliveryDate: date,
      },
      lotId,
      date,
    );
    count += selected.length;
  }
  if (!count) throw new Error("เลือกสาขาปลายทางอย่างน้อย 1 ถุง");
  return next;
}

export function BagAllocationForm({
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
  const bags = availableBags(db, lotId);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const { error, run, saving } = useSaveMutation("จัดสรรไม่สำเร็จ");
  /* The save's own change, run on the choices as they stand, so a bag that cannot go
   * where it was sent is said so while choosing instead of after บันทึก. mutate clones
   * the database, so a dry run changes nothing. Held back until at least one bag has a
   * destination: an untouched table must not be told off for being untouched. */
  const liveError = useMemo(() => {
    if (!Object.values(destinations).some(Boolean)) return "";
    try {
      buildAllocation(db, bags, destinations, lotId, date);
      return "";
    } catch (caught) {
      return caught instanceof Error ? caught.message : "";
    }
  }, [db, bags, destinations, lotId, date]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      buildAllocation(latestDatabase(), bags, destinations, lotId, date),
    );
    if (saved) onSaved();
  }
  return (
    <Dialog overline={lotId} title="จัดสรรถุงเนื้อไปสาขา" onClose={onClose}>
      <DialogForm onSubmit={submit}>
        <DialogBody>
          <WorkingDateField
            asField
            date={date}
            onDate={onDate}
            minDate={minDate}
          />
          <DataTable
            title="เลือกปลายทางทีละถุง"
            columns={["ถุง", "น้ำหนัก", "สาขาปลายทาง"]}
            rowKeys={bags.map((bag) => bag.id)}
            rows={bags.map((bag, index) => [
              `ถุงที่ ${index + 1}`,
              `${fmt(bag.weight)} กก.`,
              <Select
                key={bag.id}
                variant="filter"
                aria-label={`เลือกสาขาให้ถุงที่ ${index + 1}`}
                value={destinations[bag.id] || ""}
                onChange={(event) =>
                  setDestinations((current) => ({
                    ...current,
                    [bag.id]: event.target.value,
                  }))
                }
              >
                <option value="">ยังไม่จัดสรร</option>
                {branches.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </Select>,
            ])}
          />
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={liveError}
          hint="เลือกหลายถุงและส่งให้ทั้งสองสาขาได้ในครั้งเดียว"
          onCancel={onClose}
          submitLabel="บันทึกการจัดสรร"
        />
      </DialogForm>
    </Dialog>
  );
}
