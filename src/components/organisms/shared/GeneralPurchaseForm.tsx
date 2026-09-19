"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import { mutate } from "@/lib/store";
import { fmt } from "@/lib/format";

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
    id: crypto.randomUUID(),
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

const standardIngredients = [
  "น้ำพริกหลอด",
  "น้ำดอง",
  "ข้าวเหนียวดิบ (ข้าวสาร)",
];
const ingredientUnits: Record<string, string> = {
  น้ำพริกหลอด: "หลอด",
  น้ำดอง: "มล.",
  "ข้าวเหนียวดิบ (ข้าวสาร)": "กก.",
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

export function GeneralPurchaseForm({
  date,
  onDate,
  minDate,
  onClose,
  onSaved,
}: {
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
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
  const update = (
    id: string,
    key: keyof Omit<GeneralPurchaseLine, "id">,
    value: string,
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, [key]: value } : line,
      ),
    );
    setError("");
  };
  const chooseIngredient = (id: string, item: string) => {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              item,
              unit: ingredientUnits[item] || line.unit,
            }
          : line,
      ),
    );
    setError("");
  };
  const addLine = () =>
    setLines((current) => [...current, newGeneralPurchaseLine("")]);
  const removeLine = (id: string) =>
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== id),
    );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() => {
      let next = latestDatabase();
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
            Array.from(addedIngredients).sort((a, b) =>
              a.localeCompare(b, "th"),
            ),
          ),
        },
      };
    });
    if (saved) onSaved();
  }

  return (
    <Dialog
      overline="Owner · บัญชี"
      title="บันทึกการซื้ออื่น ๆ"
      size="xl"
      onClose={onClose}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <DialogBody>
          <WorkingDateField
            className="mb-4.5 max-w-xs text-body-sm font-medium"
            date={date}
            onDate={onDate}
            minDate={minDate}
          />
          <Notice>
            เลือกกลุ่มการซื้อของแต่ละรายการได้ เช่น วัตถุดิบ (น้ำพริกหลอด น้ำดอง
            ข้าวเหนียวดิบ) หรือสินทรัพย์ (ตู้เย็น) · เนื้อให้สร้างผ่าน PO
            และรับจาก Foodiva เพื่อผูก Lot กับสต๊อก
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
                <article
                  key={line.id}
                  className="overflow-hidden rounded-lg border border-border bg-surface"
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
                    <FormField className={lineField} label="กลุ่มการซื้อ">
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
                            chooseIngredient(line.id, event.target.value)
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
                    <FormField className={lineField} label="หน่วย">
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
                    <FormField className={lineField} label="ราคาซื้อ / หน่วย">
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
                    <FormField className={lineField} label="ผู้จำหน่าย">
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
                </article>
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
          submitDisabled={saving}
          hint="กดเพิ่มรายการเพื่อบันทึกได้ต่อเนื่อง"
          onCancel={onClose}
          submitLabel={`บันทึก ${lines.length} รายการ`}
        />
      </form>
    </Dialog>
  );
}
