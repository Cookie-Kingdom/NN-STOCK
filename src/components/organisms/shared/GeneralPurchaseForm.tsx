"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { DialogForm } from "@/components/molecules/DialogForm";
import { newId } from "@/lib/id";
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
import { mutate, type Database } from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { standardIngredients } from "@/lib/forms";

export type GeneralPurchaseLine = {
  id: string;
  purchaseDate: string;
  category: string;
  item: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  supplier: string;
  reference: string;
};

export function newGeneralPurchaseLine(date: string): GeneralPurchaseLine {
  return {
    id: newId(),
    purchaseDate: date,
    category: "วัตถุดิบ",
    item: "",
    unit: "ชิ้น",
    quantity: "",
    unitPrice: "",
    supplier: "",
    reference: "",
  };
}

const ingredientUnits: Record<string, string> = {
  น้ำพริกหลอด: "หลอด",
  น้ำดอง: "มล.",
};

function readSavedIngredients(): string[] {
  try {
    const parsed = JSON.parse(
      latestDatabase().config.customIngredients || "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
}

const lineField = "text-caption";

/** Line fields an item brings from its last purchase, and the entry key each is
 *  stored under. */
const carried = [
  ["category", "purchaseCategory"],
  ["unit", "unit"],
  ["unitPrice", "unitPrice"],
  ["supplier", "supplier"],
] as const;
type CarriedKey = (typeof carried)[number][0];

/** What the last purchase of `item` had in each carried field. */
function suggestFromItem(db: Database, item: string) {
  const out: Partial<Record<CarriedKey, { value: string; date: string }>> = {};
  if (!item || item === "__custom__") return out;
  for (const [key, stored] of carried) {
    const last = lastValue(db, "generalPurchase", stored, {
      where: (entry) => entry.values.item?.trim() === item,
    });
    if (last) out[key] = last;
  }
  return out;
}

/** The whole save, as a pure function of the starting database, so the live check
 *  can dry-run the very same code the ยืนยัน does. */
function build(
  from: Database,
  lines: GeneralPurchaseLine[],
  date: string,
  savedIngredients: string[],
) {
  let next = from;
  const addedIngredients = new Set(savedIngredients);
  for (const line of lines) {
    const item = line.item.trim();
    // A line without its own date follows the working date, like MaterialPurchaseForm.
    const purchaseDate = line.purchaseDate || date;
    const supplier = line.supplier.trim();
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    if (!item || item === "__custom__")
      throw new Error("กรอกรายการที่ซื้อให้ครบ");
    if (line.category === "วัตถุดิบ" && /เนื้อ/.test(item))
      throw new Error(
        "เนื้อให้สร้างผ่านใบสั่งซื้อ PO และยืนยันรับจาก Foodiva เพื่อเชื่อม Lot และสต๊อกให้ถูกต้อง",
      );
    if (!purchaseDate) throw new Error(`เลือกวันที่ซื้อ ${item}`);
    if (!supplier) throw new Error(`กรอกผู้จำหน่าย ${item}`);
    if (!line.unit.trim()) throw new Error(`กรอกหน่วยของ ${item}`);
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new Error(`กรอกจำนวน ${item}`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0)
      throw new Error(`กรอกราคาซื้อ ${item}`);
    next = mutate(
      next,
      "owner",
      "generalPurchase",
      {
        purchaseDate,
        purchaseCategory: line.category,
        item,
        unit: line.unit.trim(),
        quantity: String(quantity),
        unitPrice: String(unitPrice),
        supplier,
        reference: line.reference.trim(),
      },
      "",
      purchaseDate,
    );
    if (line.category === "วัตถุดิบ" && !standardIngredients.includes(item))
      addedIngredients.add(item);
  }
  return {
    ...next,
    config: {
      ...next.config,
      customIngredients: JSON.stringify(
        Array.from(addedIngredients).sort((a, b) => a.localeCompare(b, "th")),
      ),
    },
  };
}

export function GeneralPurchaseForm({
  date,
  onDate,
  onClose,
  onSaved,
}: {
  date: string;
  onDate: (date: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  // ponytail: read once on open; the saved list only changes when this form saves and closes.
  const [savedIngredients] = useState(readSavedIngredients);
  const ingredientOptions = Array.from(
    new Set([...standardIngredients, ...savedIngredients]),
  );
  const [lines, setLines] = useState<GeneralPurchaseLine[]>(() => [
    newGeneralPurchaseLine(""),
  ]);
  const { error, setError, run, saving } = useSaveMutation(
    "บันทึกการซื้ออื่น ๆ ไม่สำเร็จ",
  );
  const total = lines.reduce(
    (sum, line) =>
      sum + Number(line.quantity || 0) * Number(line.unitPrice || 0),
    0,
  );
  /** Captions of the values an item filled in, by `lineId:key`. */
  const [sources, setSources] = useState<Record<string, PrefillSource>>({});
  /** `lineId:key` of the fields the user has changed: an item never refills them. */
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const update = (
    id: string,
    key: keyof Omit<GeneralPurchaseLine, "id">,
    value: string,
  ) => {
    if (key === "item") return chooseItem(id, value);
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, [key]: value } : line,
      ),
    );
    const name = `${id}:${key}`;
    setTouched((current) => new Set(current).add(name));
    setSources((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setError("");
  };
  /** Sets the line's item and, in the fields the user has not changed, what the last
   *  purchase of that item had. Fields an earlier item filled go back to blank when the
   *  new one was never bought. */
  const chooseItem = (id: string, item: string) => {
    const line = lines.find((current) => current.id === id);
    if (!line) return;
    const suggestion = suggestFromItem(latestDatabase(), item.trim());
    const blank = newGeneralPurchaseLine("");
    const next: GeneralPurchaseLine = { ...line, item };
    const nextSources = { ...sources };
    for (const [key] of carried) {
      const name = `${id}:${key}`;
      if (touched.has(name)) continue;
      const last = suggestion[key];
      if (last) {
        next[key] = last.value;
        nextSources[name] = { label: lastLabel(last.date) };
      } else if (nextSources[name]) {
        next[key] = blank[key];
        delete nextSources[name];
      }
    }
    if (ingredientUnits[item]) {
      next.unit = ingredientUnits[item];
      delete nextSources[`${id}:unit`];
    }
    setLines((current) =>
      current.map((other) => (other.id === id ? next : other)),
    );
    setSources(nextSources);
    setError("");
  };
  const source = (id: string, key: CarriedKey) => sources[`${id}:${key}`];
  const complete = lines.every(
    (line) =>
      line.item.trim() &&
      line.item !== "__custom__" &&
      (line.purchaseDate || date) &&
      line.unit.trim() &&
      line.quantity.trim() &&
      line.unitPrice.trim() &&
      line.supplier.trim(),
  );
  /* The save's own code, dry-run on the lines as they stand, so a bad line is
   * reported while it is being typed instead of after ยืนยัน. mutate clones the
   * database, so a dry run changes nothing. Held back until every line is filled
   * in: an unfinished form must not be told off for being unfinished. */
  const liveError = useMemo(() => {
    if (!complete) return "";
    try {
      build(latestDatabase(), lines, date, savedIngredients);
      return "";
    } catch (caught) {
      return caught instanceof Error ? caught.message : "";
    }
  }, [complete, lines, date, savedIngredients]);
  const addLine = () =>
    setLines((current) => [...current, newGeneralPurchaseLine("")]);
  const removeLine = (id: string) =>
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== id),
    );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      build(latestDatabase(), lines, date, savedIngredients),
    );
    if (saved) onSaved();
  }

  return (
    <Dialog
      overline="Owner · บัญชี"
      title="บันทึกการซื้ออื่น ๆ"
      size="xl"
      onClose={onClose}
    >
      <DialogForm onSubmit={submit}>
        <DialogBody>
          <WorkingDateField asField date={date} onDate={onDate} />
          <Notice>
            เลือกกลุ่มการซื้อของแต่ละรายการได้ เช่น วัตถุดิบ (น้ำพริกหลอด
            น้ำดอง) หรือสินทรัพย์ (ตู้เย็น) · เนื้อให้สร้างผ่าน PO และรับจาก
            Foodiva เพื่อผูก Lot กับสต๊อก
          </Notice>
          <div className="mt-5.5 grid gap-3.5">
            {lines.map((line, index) => {
              const amount =
                Number(line.quantity || 0) * Number(line.unitPrice || 0);
              const isIngredient = line.category === "วัตถุดิบ";
              const customIngredient =
                isIngredient &&
                line.item !== "" &&
                !ingredientOptions.includes(line.item);
              const ingredientChoice = customIngredient
                ? "__custom__"
                : line.item;
              const fixedUnit = isIngredient
                ? ingredientUnits[line.item]
                : undefined;
              return (
                <Panel
                  as="article"
                  flush
                  key={line.id}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3.5 bg-bg px-4.5 py-3.5 max-[560px]:flex-wrap">
                    <strong className="mr-auto">รายการซื้อ {index + 1}</strong>
                    <span className="font-bold text-text-secondary">
                      ยอดรวม ฿{fmt(amount)}
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      className="px-2.5"
                      aria-label={`ลบรายการ ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => removeLine(line.id)}
                    >
                      ลบ
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-4.5 max-[800px]:grid-cols-2 max-[560px]:grid-cols-1">
                    <FormField
                      className={lineField}
                      label="กลุ่มการซื้อ"
                      prefilled={source(line.id, "category")}
                    >
                      <Select
                        aria-label={`กลุ่มการซื้อ ${index + 1}`}
                        value={line.category}
                        onChange={(event) =>
                          update(line.id, "category", event.target.value)
                        }
                      >
                        <option>วัตถุดิบ</option>
                        <option>สินทรัพย์</option>
                        <option>ค่าใช้จ่ายอื่น</option>
                      </Select>
                    </FormField>
                    {isIngredient ? (
                      <FormField className={lineField} label="วัตถุดิบ">
                        <Select
                          aria-label={`เลือกวัตถุดิบ ${index + 1}`}
                          value={ingredientChoice}
                          onChange={(event) =>
                            chooseItem(line.id, event.target.value)
                          }
                        >
                          <option value="">เลือกวัตถุดิบ</option>
                          {ingredientOptions.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                          <option value="__custom__">
                            + เพิ่มวัตถุดิบใหม่
                          </option>
                        </Select>
                        {customIngredient && (
                          <Input
                            aria-label={`ชื่อวัตถุดิบใหม่ ${index + 1}`}
                            placeholder="พิมพ์ชื่อวัตถุดิบใหม่"
                            value={line.item === "__custom__" ? "" : line.item}
                            onChange={(event) =>
                              update(line.id, "item", event.target.value)
                            }
                          />
                        )}
                      </FormField>
                    ) : (
                      <FormField className={lineField} label="รายการ">
                        <Input
                          type="text"
                          aria-label={`รายการซื้อ ${index + 1}`}
                          placeholder="เช่น ตู้เย็น"
                          value={line.item}
                          onChange={(event) =>
                            update(line.id, "item", event.target.value)
                          }
                        />
                      </FormField>
                    )}
                    <FormField className={lineField} label="วันที่ซื้อ">
                      <Input
                        type="date"
                        max={today()}
                        aria-label={`วันที่ซื้อ ${index + 1}`}
                        value={line.purchaseDate || date}
                        onChange={(event) =>
                          update(line.id, "purchaseDate", event.target.value)
                        }
                      />
                    </FormField>
                    <FormField className={lineField} label="จำนวน">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`จำนวน ${index + 1}`}
                        placeholder="จำนวน"
                        value={line.quantity}
                        onChange={(event) =>
                          update(line.id, "quantity", event.target.value)
                        }
                      />
                    </FormField>
                    <FormField
                      className={lineField}
                      label="หน่วย"
                      prefilled={
                        fixedUnit ? undefined : source(line.id, "unit")
                      }
                    >
                      <Input
                        type="text"
                        aria-label={`หน่วย ${index + 1}`}
                        placeholder="เช่น หลอด, มล., เครื่อง"
                        value={fixedUnit || line.unit}
                        disabled={!!fixedUnit}
                        onChange={(event) =>
                          update(line.id, "unit", event.target.value)
                        }
                      />
                    </FormField>
                    <FormField
                      className={lineField}
                      label="ราคาซื้อ / หน่วย"
                      prefilled={source(line.id, "unitPrice")}
                    >
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`ราคาต่อหน่วย ${index + 1}`}
                        placeholder="0.00"
                        value={line.unitPrice}
                        onChange={(event) =>
                          update(line.id, "unitPrice", event.target.value)
                        }
                      />
                    </FormField>
                    <FormField
                      className={lineField}
                      label="ผู้จำหน่าย"
                      prefilled={source(line.id, "supplier")}
                    >
                      <Input
                        type="text"
                        aria-label={`ผู้จำหน่าย ${index + 1}`}
                        placeholder="ผู้ขาย"
                        value={line.supplier}
                        onChange={(event) =>
                          update(line.id, "supplier", event.target.value)
                        }
                      />
                    </FormField>
                    <FormField
                      className={lineField}
                      label="เลขอ้างอิง / ใบเสร็จ"
                    >
                      <Input
                        type="text"
                        aria-label={`ใบเสร็จ ${index + 1}`}
                        placeholder="เลขที่ (ถ้ามี)"
                        value={line.reference}
                        onChange={(event) =>
                          update(line.id, "reference", event.target.value)
                        }
                      />
                    </FormField>
                  </div>
                </Panel>
              );
            })}
          </div>
          <ButtonRow className="mt-4.5">
            <Button variant="secondary" icon={<Plus />} onClick={addLine}>
              เพิ่มรายการ
            </Button>
            <Notice tone="success" role="none" className="my-0">
              {lines.length} รายการ · ยอดซื้อรวม ฿{fmt(total)}
            </Notice>
          </ButtonRow>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          submitting={saving}
          error={liveError}
          hint="กดเพิ่มรายการเพื่อบันทึกได้ต่อเนื่อง"
          onCancel={onClose}
          submitLabel={`บันทึก ${lines.length} รายการ`}
        />
      </DialogForm>
    </Dialog>
  );
}
