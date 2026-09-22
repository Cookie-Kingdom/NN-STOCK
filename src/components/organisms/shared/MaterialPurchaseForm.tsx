"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/atoms/Checkbox";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import { lastLabel, lastValue, type PrefillSource } from "@/lib/prefill";
import {
  materials,
  materialUnitPrice,
  mutate,
  n,
  ownerMaterialStock,
  type Database,
  type Values,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { cn } from "@/lib/utils";

const purchaseLines = materials.map((material) => ({
  key: `material-${material}`,
  label: material,
  unit: "ชิ้น",
}));

const lineField = "text-caption";

type LineField = "quantity" | "unitPrice" | "supplier";

/** What a ticked line starts with: จำนวน ราคา and ผู้จำหน่าย from the last purchase
 *  of that material, the price falling back to the one set in ตั้งค่า. */
function suggestLine(db: Database, material: string) {
  const out: Partial<Record<LineField, { value: string } & PrefillSource>> = {};
  const where = {
    where: (e: { values: Values }) => e.values.material === material,
  };
  for (const field of ["quantity", "unitPrice", "supplier"] as const) {
    const last = lastValue(db, "materialReceive", field, where);
    if (last) out[field] = { value: last.value, label: lastLabel(last.date) };
  }
  const configured = materialUnitPrice(db, "", materials.indexOf(material));
  if (!out.unitPrice && configured)
    out.unitPrice = { value: String(configured), label: "ราคาตั้งค่า" };
  return out;
}

/** The change the save would make, from whichever database it is given. Shared by
 *  submit and the live check so both refuse for exactly the same reason. */
function build(
  from: Database,
  date: string,
  checked: Record<string, boolean>,
  quantities: Values,
  unitPrices: Values,
  purchaseDates: Values,
  suppliers: Values,
  references: Values,
) {
  const selected = purchaseLines.filter((line) => checked[line.key]);
  if (!selected.length) throw new Error("ติ๊กเลือกอย่างน้อย 1 รายการ");
  let next = from;
  for (const line of selected) {
    const item = line.label;
    const purchaseDate = purchaseDates[line.key] || date;
    const quantity = Number(quantities[line.key]);
    const unitPrice = Number(unitPrices[line.key]);
    const supplier = suppliers[line.key]?.trim();
    const reference = references[line.key]?.trim() || "";
    if (!purchaseDate) throw new Error(`เลือกวันที่ซื้อ ${item}`);
    if (!supplier) throw new Error(`กรอกผู้จำหน่าย ${item}`);
    if (!Number.isInteger(quantity) || quantity <= 0)
      throw new Error(`กรอกจำนวน ${item} เป็นจำนวนเต็มที่มากกว่า 0`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0)
      throw new Error(`กรอกราคาซื้อ ${item}`);
    next = mutate(
      next,
      "owner",
      "materialReceive",
      {
        purchaseDate,
        material: item,
        quantity: String(quantity),
        unitPrice: String(unitPrice),
        supplier,
        reference,
      },
      "",
      purchaseDate,
    );
  }
  return next;
}

export function MaterialPurchaseForm({
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
  const [unitPrices, setUnitPrices] = useState<Values>({});
  const [purchaseDates, setPurchaseDates] = useState<Values>({});
  const [suppliers, setSuppliers] = useState<Values>({});
  const [references, setReferences] = useState<Values>({});
  /** Captions of the values a tick filled in, by `field:lineKey`; an edit drops one. */
  const [sources, setSources] = useState<Record<string, PrefillSource>>({});
  const setters = {
    quantity: setQuantities,
    unitPrice: setUnitPrices,
    supplier: setSuppliers,
  };
  const given = {
    quantity: quantities,
    unitPrice: unitPrices,
    supplier: suppliers,
  };
  /** Fills the ticked line's fields that were never given a value; one the user has
   *  typed in, even cleared, is left as it is. */
  function fillLine(lineKey: string, material: string) {
    const suggestion = suggestLine(db, material);
    const filled: Record<string, PrefillSource> = {};
    for (const field of ["quantity", "unitPrice", "supplier"] as const) {
      const value = suggestion[field];
      if (!value || given[field][lineKey] !== undefined) continue;
      setters[field]((values) => ({ ...values, [lineKey]: value.value }));
      filled[`${field}:${lineKey}`] = { label: value.label };
    }
    setSources((all) => ({ ...all, ...filled }));
  }
  function edit(field: LineField, lineKey: string, value: string) {
    setters[field]((values) => ({ ...values, [lineKey]: value }));
    setSources((all) => {
      const next = { ...all };
      delete next[`${field}:${lineKey}`];
      return next;
    });
  }
  const { error, setError, run, saving } = useSaveMutation(
    "บันทึกการซื้อวัสดุไม่สำเร็จ",
  );
  const selected = purchaseLines.filter((line) => checked[line.key]);
  const total = selected.reduce(
    (sum, line) => sum + n(quantities, line.key) * n(unitPrices, line.key),
    0,
  );
  /* The save's own mutate, run on the values as they stand, so a refusal shows while
   * the line is being typed instead of after บันทึก. mutate clones the database, so a
   * dry run changes nothing. Held back until every ticked line has its วันที่ จำนวน
   * ราคา and ผู้จำหน่าย: an unfinished form must not be told off for being
   * unfinished. */
  const liveError = useMemo(() => {
    const ticked = purchaseLines.filter((line) => checked[line.key]);
    const complete =
      ticked.length > 0 &&
      ticked.every(
        (line) =>
          (purchaseDates[line.key] ?? date) &&
          quantities[line.key]?.trim() &&
          unitPrices[line.key]?.trim() &&
          suppliers[line.key]?.trim(),
      );
    if (!complete) return "";
    try {
      build(
        db,
        date,
        checked,
        quantities,
        unitPrices,
        purchaseDates,
        suppliers,
        references,
      );
      return "";
    } catch (caught) {
      return caught instanceof Error ? caught.message : "";
    }
  }, [
    db,
    date,
    checked,
    quantities,
    unitPrices,
    purchaseDates,
    suppliers,
    references,
  ]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      build(
        latestDatabase(),
        date,
        checked,
        quantities,
        unitPrices,
        purchaseDates,
        suppliers,
        references,
      ),
    );
    if (saved) onSaved(saved);
  }

  return (
    <Dialog
      overline="Owner · สต๊อกวัสดุ"
      title="ซื้อวัสดุเข้าคลัง"
      size="xl"
      onClose={onClose}
    >
      {/* noValidate: the checks in submit() were unreachable behind the native
          `required` bubble, which is not in the DOM and closes with the dialog
          on Escape. */}
      <DialogForm noValidate onSubmit={submit}>
        <DialogBody>
          <WorkingDateField asField date={date} onDate={onDate} />
          <Notice>
            ติ๊กวัสดุที่ซื้อ แล้วกรอกวันที่ซื้อ ผู้จำหน่าย
            และเลขอ้างอิงของรายการนั้นเอง ระบบจะเพิ่มจำนวนเข้า Owner Stock
          </Notice>
          <div className="mt-5.5 grid gap-3">
            {purchaseLines.map((line) => {
              const selectedRow = !!checked[line.key];
              const amount = n(quantities, line.key) * n(unitPrices, line.key);
              return (
                <Panel
                  as="article"
                  flush
                  key={line.key}
                  className={cn("overflow-hidden", selectedRow && "bg-bg")}
                >
                  <label className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3.25 px-4.5 py-4 max-[560px]:grid-cols-[24px_minmax(0,1fr)]">
                    <Checkbox
                      aria-label={`ซื้อ ${line.label}`}
                      checked={selectedRow}
                      onChange={(event) => {
                        setChecked((current) => ({
                          ...current,
                          [line.key]: event.target.checked,
                        }));
                        if (event.target.checked)
                          fillLine(line.key, line.label);
                        setError("");
                      }}
                    />
                    <span>
                      <strong className="block">{line.label}</strong>
                      <small className="mt-1 block text-caption font-normal text-text-secondary">
                        คงคลัง Owner {fmt(ownerMaterialStock(db, line.label))}{" "}
                        ชิ้น
                      </small>
                    </span>
                    <b className="text-body-sm whitespace-nowrap text-text-secondary max-[560px]:col-start-2">
                      {selectedRow
                        ? `ยอดซื้อ ฿${fmt(amount)}`
                        : "ติ๊กเพื่อกรอก"}
                    </b>
                  </label>
                  {selectedRow && (
                    <div className="grid grid-cols-5 gap-3.5 border-t border-border bg-bg pt-4 pr-4.5 pb-4.5 pl-13.75 max-[900px]:grid-cols-2 max-[900px]:pl-4.5 max-[560px]:grid-cols-1">
                      <FormField className={lineField} label="วันที่ซื้อ">
                        <Input
                          type="date"
                          // What is already bought cannot have been bought tomorrow.
                          max={today()}
                          aria-label={`วันที่ซื้อ ${line.label}`}
                          value={purchaseDates[line.key] ?? date}
                          onChange={(event) =>
                            setPurchaseDates((current) => ({
                              ...current,
                              [line.key]: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                      <FormField
                        className={lineField}
                        label="จำนวนที่ซื้อ"
                        prefilled={sources[`quantity:${line.key}`]}
                      >
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          aria-label={`จำนวนซื้อ ${line.label}`}
                          required
                          placeholder="จำนวน"
                          value={quantities[line.key] || ""}
                          onChange={(event) =>
                            edit("quantity", line.key, event.target.value)
                          }
                        />
                      </FormField>
                      <FormField
                        className={lineField}
                        label="ราคาซื้อ / หน่วย"
                        prefilled={sources[`unitPrice:${line.key}`]}
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          aria-label={`ราคาซื้อ ${line.label}`}
                          required
                          placeholder="0.00"
                          value={unitPrices[line.key] || ""}
                          onChange={(event) =>
                            edit("unitPrice", line.key, event.target.value)
                          }
                        />
                      </FormField>
                      <FormField
                        className={lineField}
                        label="ผู้จำหน่าย"
                        prefilled={sources[`supplier:${line.key}`]}
                      >
                        <Input
                          type="text"
                          aria-label={`ผู้จำหน่าย ${line.label}`}
                          required
                          placeholder="ผู้ขาย"
                          value={suppliers[line.key] || ""}
                          onChange={(event) =>
                            edit("supplier", line.key, event.target.value)
                          }
                        />
                      </FormField>
                      <FormField
                        className={lineField}
                        label="เลขอ้างอิง / ใบเสร็จ"
                      >
                        <Input
                          type="text"
                          aria-label={`ใบเสร็จ ${line.label}`}
                          placeholder="เลขที่ (ถ้ามี)"
                          value={references[line.key] || ""}
                          onChange={(event) =>
                            setReferences((current) => ({
                              ...current,
                              [line.key]: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
          <Notice tone="success" role="none" className="mt-4.5 mb-0">
            เลือก {selected.length} รายการ · ยอดซื้อรวม ฿{fmt(total)}
          </Notice>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={liveError}
          hint="บันทึกครั้งเดียวได้หลายวัสดุ"
          onCancel={onClose}
          submitLabel={`บันทึกการซื้อ ${selected.length ? `${selected.length} รายการ` : ""}`}
        />
      </DialogForm>
    </Dialog>
  );
}
