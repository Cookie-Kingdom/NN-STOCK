"use client";

import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import {
  branches,
  materials,
  mutate,
  ownerMaterialStock,
  type Database,
  type Values,
} from "@/lib/store";

const key = (index: number, branch: string) => `${index}-${branch}`;
const cell = "border-b border-border px-4.5 py-3.5 align-middle max-md:px-2.5";
const headCell =
  "border-b border-border bg-bg px-4.5 py-3.5 text-left text-caption font-semibold text-text-secondary max-md:px-2.5";

export function MaterialTransferForm({
  db,
  date,
  onDate,
  minDate,
  onClose,
  onSaved,
}: {
  db: Database;
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Values>({});
  const [receivers, setReceivers] = useState<Values>({});
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const selectedFor = (branch: string) =>
    materials.some((_, index) => checked[key(index, branch)]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() => {
      let next = latestDatabase();
      let count = 0;
      for (const [index, material] of materials.entries()) {
        for (const branch of branches) {
          const field = key(index, branch);
          if (!checked[field]) continue;
          const quantity = Number(quantities[field]);
          if (!Number.isInteger(quantity) || quantity <= 0)
            throw new Error(`กรอกจำนวน ${material} ที่ส่งไป${branch}`);
          if (!receivers[branch]?.trim())
            throw new Error(`กรอกชื่อผู้รับของสาขา${branch}`);
          next = mutate(
            next,
            "owner",
            "materialTransfer",
            {
              material,
              branch,
              quantity: String(quantity),
              receiver: receivers[branch],
              reference,
              note,
            },
            "",
            date,
          );
          count++;
        }
      }
      if (!count) throw new Error("ติ๊กเลือกวัสดุและสาขาที่ต้องการส่ง");
      return next;
    });
    if (saved) onSaved(saved);
  }

  return (
    <Dialog
      overline={`${date} · Owner`}
      title="ส่งวัสดุไปสาขา"
      size="wide"
      onClose={onClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        noValidate
        onSubmit={submit}
      >
        <DialogBody>
          <WorkingDateField
            className="mb-4.5 max-w-xs text-body-sm font-medium"
            date={date}
            onDate={onDate}
            minDate={minDate}
          />
          <Notice>
            ติ๊กสาขาที่ต้องการส่ง แล้วกรอกจำนวน
            สามารถเลือกหลายรายการและบันทึกพร้อมกันได้
          </Notice>
          <div className="mt-5.5 mb-7 max-w-full overflow-auto overscroll-x-contain rounded-lg border border-border bg-surface">
            <table className="w-full table-fixed border-separate border-spacing-0 [&_tbody_tr:last-child_td]:border-b-0">
              <thead>
                <tr>
                  <th className={`${headCell} w-[28%]`}>วัสดุ</th>
                  <th className={`${headCell} w-[14%] text-right`}>
                    คลัง Owner
                  </th>
                  {branches.map((branch) => (
                    <th key={branch} className={`${headCell} w-[29%]`}>
                      {branch}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materials.map((material, index) => (
                  <tr key={material} className="hover:bg-bg">
                    <td className={`${cell} leading-snug whitespace-normal`}>
                      <strong>{material}</strong>
                    </td>
                    <td
                      className={`${cell} text-right font-semibold text-accent tabular-nums`}
                    >
                      {ownerMaterialStock(db, material)} ชิ้น
                    </td>
                    {branches.map((branch) => {
                      const field = key(index, branch);
                      return (
                        <td key={branch} className={cell}>
                          <div className="grid grid-cols-[24px_minmax(100px,1fr)] items-center gap-3 max-md:grid-cols-[20px_minmax(48px,1fr)] max-md:gap-1.5">
                            <input
                              type="checkbox"
                              className="size-4.5"
                              aria-label={`ส่ง ${material} ไป${branch}`}
                              checked={!!checked[field]}
                              onChange={(event) => {
                                setChecked((current) => ({
                                  ...current,
                                  [field]: event.target.checked,
                                }));
                                setError("");
                              }}
                            />
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="จำนวน"
                              aria-label={`จำนวน ${material} ไป${branch}`}
                              className="mt-0 min-h-10.5 px-2.75 py-2.25 max-md:px-1.5"
                              disabled={!checked[field]}
                              value={quantities[field] || ""}
                              onChange={(event) =>
                                setQuantities((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg border border-border bg-bg p-5 max-md:grid-cols-1 max-md:gap-4">
            {branches.map((branch) => (
              <FormField key={branch} label={`ผู้รับของสาขา${branch}`}>
                <Input
                  type="text"
                  value={receivers[branch] || ""}
                  disabled={!selectedFor(branch)}
                  required={selectedFor(branch)}
                  onChange={(event) =>
                    setReceivers((current) => ({
                      ...current,
                      [branch]: event.target.value,
                    }))
                  }
                />
              </FormField>
            ))}
            <FormField label="เลขที่ใบส่งของ (ถ้ามี)">
              <Input
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </FormField>
            <FormField label="หมายเหตุ (ถ้ามี)">
              <Input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormField>
          </div>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          hint="ทุกรายการจะบันทึกพร้อมกัน"
          onCancel={onClose}
          submitLabel="บันทึกส่งวัสดุ"
        />
      </form>
    </Dialog>
  );
}
