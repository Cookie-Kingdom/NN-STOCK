"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/atoms/Checkbox";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField, PrefillCaption } from "@/components/molecules/FormField";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import { lastLabel, lastValue, type PrefillSource } from "@/lib/prefill";
import {
  branches,
  branchMaterialStock,
  materialPar,
  materials,
  mutate,
  OverStockError,
  ownerMaterialStock,
  type Database,
  type Values,
} from "@/lib/store";

const key = (index: number, branch: string) => `${index}-${branch}`;
const cell = "border-b border-border px-4.5 py-3.5 align-middle max-md:px-2.5";
const headCell =
  "border-b border-border bg-bg px-4.5 py-3.5 text-left text-caption font-semibold text-text-secondary max-md:px-2.5";

const toPar = { label: "เติมถึง par" };

/** What brings the branch back up to its par on `date`, if it is short. */
function shortfall(db: Database, branch: string, index: number, date: string) {
  const short =
    materialPar(db, branch, index) -
    branchMaterialStock(db, branch, index, date);
  return short > 0 ? String(short) : undefined;
}

/** The change the save would make, from whichever database it is given. Shared by
 *  submit and the live check so both refuse for exactly the same reason. */
function build(
  from: Database,
  date: string,
  checked: Record<string, boolean>,
  quantities: Values,
  receivers: Values,
  reference: string,
  note: string,
) {
  let next = from;
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
}

export function MaterialTransferForm({
  db,
  date,
  onDate,
  onClose,
  onSaved,
}: {
  db: Database;
  date: string;
  onDate: (date: string) => void;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Values>({});
  const [receivers, setReceivers] = useState<Values>({});
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  /** Captions of the values a tick filled in, by quantity field or branch name. */
  const [sources, setSources] = useState<Record<string, PrefillSource>>({});
  const dropSource = (name: string) =>
    setSources((all) => {
      const next = { ...all };
      delete next[name];
      return next;
    });
  /** Fills what the tick needs and nobody has typed yet: the จำนวน up to the branch's
   *  par, and the branch's ผู้รับ from its last transfer. */
  function fillTick(field: string, branch: string, index: number) {
    const filled: Record<string, PrefillSource> = {};
    const quantity = shortfall(db, branch, index, date);
    if (quantity && quantities[field] === undefined) {
      setQuantities((values) => ({ ...values, [field]: quantity }));
      filled[field] = toPar;
    }
    const receiver = lastValue(db, "materialTransfer", "receiver", { branch });
    if (receiver && receivers[branch] === undefined) {
      setReceivers((values) => ({ ...values, [branch]: receiver.value }));
      filled[branch] = { label: lastLabel(receiver.date) };
    }
    setSources((all) => ({ ...all, ...filled }));
  }
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const selectedFor = (branch: string) =>
    materials.some((_, index) => checked[key(index, branch)]);
  const ticked = materials.flatMap((_, index) =>
    branches
      .filter((branch) => checked[key(index, branch)])
      .map((branch) => ({ field: key(index, branch), branch })),
  );
  const complete =
    ticked.length > 0 &&
    ticked.every(
      (t) => quantities[t.field]?.trim() && receivers[t.branch]?.trim(),
    );
  /* The save's own mutate, run on the values as they stand, so the form can say the
   * Owner stock is short while the number is being typed instead of after ยืนยัน.
   * mutate clones the database, so a dry run changes nothing. Until every ticked row
   * has its จำนวน and ผู้รับ only a short stock is said (a blank ผู้รับ stands in for
   * the run): an unfinished form must not be told off for being unfinished. */
  const liveError = useMemo(() => {
    const standIn = complete
      ? receivers
      : Object.fromEntries(
          branches.map((branch) => [branch, receivers[branch]?.trim() || "-"]),
        );
    try {
      build(db, date, checked, quantities, standIn, reference, note);
      return "";
    } catch (caught) {
      if (!complete && !(caught instanceof OverStockError)) return "";
      return caught instanceof Error ? caught.message : "";
    }
  }, [complete, db, date, checked, quantities, receivers, reference, note]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      build(
        latestDatabase(),
        date,
        checked,
        quantities,
        receivers,
        reference,
        note,
      ),
    );
    if (saved) onSaved(saved);
  }

  return (
    <Dialog
      overline={`${date} · Owner`}
      title="ส่งวัสดุไปสาขา"
      size="wide"
      onClose={onClose}
    >
      <DialogForm noValidate onSubmit={submit}>
        <DialogBody>
          <WorkingDateField asField date={date} onDate={onDate} />
          <Notice>
            ติ๊กสาขาที่ต้องการส่ง แล้วกรอกจำนวน
            สามารถเลือกหลายรายการและบันทึกพร้อมกันได้
          </Notice>
          <Panel
            as="div"
            flush
            className="mt-5.5 mb-7 max-w-full overflow-auto overscroll-x-contain"
          >
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
                            <Checkbox
                              aria-label={`ส่ง ${material} ไป${branch}`}
                              checked={!!checked[field]}
                              onChange={(event) => {
                                setChecked((current) => ({
                                  ...current,
                                  [field]: event.target.checked,
                                }));
                                if (event.target.checked)
                                  fillTick(field, branch, index);
                                setError("");
                              }}
                            />
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              inputMode="numeric"
                              placeholder="จำนวน"
                              aria-label={`จำนวน ${material} ไป${branch}`}
                              className="mt-0 min-h-10.5 px-2.75 py-2.25 max-md:px-1.5"
                              disabled={!checked[field]}
                              prefilled={
                                checked[field] && sources[field]
                                  ? "auto"
                                  : undefined
                              }
                              value={quantities[field] || ""}
                              onChange={(event) => {
                                setQuantities((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }));
                                dropSource(field);
                              }}
                            />
                            {checked[field] && sources[field] && (
                              <div className="col-start-2 -mt-1.5">
                                <PrefillCaption {...sources[field]} />
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          {/* Not FormGrid: this card sets its own split gaps, so only the surface is shared. */}
          <Panel
            as="div"
            flush
            className="grid grid-cols-2 gap-x-6 gap-y-5 bg-bg p-5 max-md:grid-cols-1 max-md:gap-4"
          >
            {branches.map((branch) => (
              <FormField
                key={branch}
                label={`ผู้รับของสาขา${branch}`}
                prefilled={selectedFor(branch) ? sources[branch] : undefined}
              >
                <Input
                  type="text"
                  value={receivers[branch] || ""}
                  disabled={!selectedFor(branch)}
                  required={selectedFor(branch)}
                  onChange={(event) => {
                    setReceivers((current) => ({
                      ...current,
                      [branch]: event.target.value,
                    }));
                    dropSource(branch);
                  }}
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
          </Panel>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={liveError}
          hint="ทุกรายการจะบันทึกพร้อมกัน"
          onCancel={onClose}
          submitLabel="บันทึกส่งวัสดุ"
        />
      </DialogForm>
    </Dialog>
  );
}
