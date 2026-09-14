"use client";

import { useState } from "react";
import { Select } from "@/components/atoms/Select";
import { FormError } from "@/components/molecules/FormError";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import { availableBags, branches, mutate, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function BagAllocationForm({
  db,
  lotId,
  date,
  onClose,
  onSaved,
}: {
  db: Database;
  lotId: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const bags = availableBags(db, lotId);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const { error, run, saving } = useSaveMutation("จัดสรรไม่สำเร็จ");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() => {
      let next = latestDatabase();
      let count = 0;
      for (const branchName of branches) {
        const selected = bags.filter(
          (bag) => destinations[bag.id] === branchName,
        );
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
    });
    if (saved) onSaved();
  }
  return (
    <Dialog overline={lotId} title="จัดสรรถุงเนื้อไปสาขา" onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <DialogBody>
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
          submitDisabled={saving}
          hint="เลือกหลายถุงและส่งให้ทั้งสองสาขาได้ในครั้งเดียว"
          onCancel={onClose}
          submitLabel="บันทึกการจัดสรร"
        />
      </form>
    </Dialog>
  );
}
