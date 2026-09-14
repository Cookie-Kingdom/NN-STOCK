"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
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

export function GeneralPurchaseForm({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const standardIngredients = ["น้ำพริกหลอด", "น้ำดอง", "ข้าวเหนียวดิบ (ข้าวสาร)"];
  let savedIngredients: string[] = [];
  try {
    const parsed = JSON.parse(latestDatabase().config.customIngredients || "[]");
    if (Array.isArray(parsed)) savedIngredients = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    savedIngredients = [];
  }
  const ingredientOptions = Array.from(new Set([...standardIngredients, ...savedIngredients]));
  const ingredientUnits: Record<string, string> = {
    "น้ำพริกหลอด": "หลอด",
    "น้ำดอง": "มล.",
    "ข้าวเหนียวดิบ (ข้าวสาร)": "กก.",
  };
  const [lines, setLines] = useState<GeneralPurchaseLine[]>(() => [newGeneralPurchaseLine(date)]);
  const [error, setError] = useState("");
  const total = lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0),
    0,
  );
  const update = (id: string, key: keyof Omit<GeneralPurchaseLine, "id">, value: string) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [key]: value } : line));
    setError("");
  };
  const chooseIngredient = (id: string, item: string) => {
    setLines((current) => current.map((line) => line.id === id ? {
      ...line,
      item,
      unit: ingredientUnits[item] || line.unit,
    } : line));
    setError("");
  };
  const addLine = () => setLines((current) => [...current, newGeneralPurchaseLine(date)]);
  const removeLine = (id: string) => setLines((current) => current.length === 1 ? current : current.filter((line) => line.id !== id));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      let next = latestDatabase();
      const addedIngredients = new Set(savedIngredients);
      for (const line of lines) {
        const item = line.item.trim();
        const supplier = line.supplier.trim();
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        if (!item || item === "__custom__") throw new Error("กรอกรายการที่ซื้อให้ครบ");
        if (line.category === "วัตถุดิบ" && /เนื้อ/.test(item))
          throw new Error("เนื้อให้สร้างผ่านใบสั่งซื้อ PO และยืนยันรับจาก Food Diva เพื่อเชื่อม Lot และสต๊อกให้ถูกต้อง");
        if (!line.purchaseDate) throw new Error(`เลือกวันที่ซื้อ ${item}`);
        if (!supplier) throw new Error(`กรอกผู้จำหน่าย ${item}`);
        if (!line.unit.trim()) throw new Error(`กรอกหน่วยของ ${item}`);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`กรอกจำนวน ${item}`);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`กรอกราคาซื้อ ${item}`);
        next = mutate(next, "owner", "generalPurchase", {
          purchaseDate: line.purchaseDate,
          purchaseCategory: line.category,
          item,
          unit: line.unit.trim(),
          quantity: String(quantity),
          unitPrice: String(unitPrice),
          supplier,
          reference: line.reference.trim(),
        }, "", line.purchaseDate);
        if (line.category === "วัตถุดิบ" && !standardIngredients.includes(item)) addedIngredients.add(item);
      }
      next = {
        ...next,
        config: { ...next.config, customIngredients: JSON.stringify(Array.from(addedIngredients).sort((a, b) => a.localeCompare(b, "th"))) },
      };
      saveDatabase(next);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกการซื้ออื่น ๆ ไม่สำเร็จ");
    }
  }

  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="general-purchase-title" className="form-dialog material-transfer-dialog general-purchase-dialog">
        <header>
          <div>
            <span className="overline">Owner · บัญชี</span>
            <h2 id="general-purchase-title">บันทึกการซื้ออื่น ๆ</h2>
          </div>
          <button type="button" className="icon-button" aria-label="ปิดฟอร์ม" onClick={onClose}><X /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-body">
            <div className="notice">เลือกกลุ่มการซื้อของแต่ละรายการได้ เช่น วัตถุดิบ (น้ำพริกหลอด น้ำดอง ข้าวเหนียวดิบ) หรือสินทรัพย์ (ตู้เย็น) · เนื้อให้สร้างผ่าน PO และรับจาก Food Diva เพื่อผูก Lot กับสต๊อก</div>
            <div className="general-purchase-list">
              {lines.map((line, index) => {
                const amount = Number(line.quantity || 0) * Number(line.unitPrice || 0);
                const isIngredient = line.category === "วัตถุดิบ";
                const customIngredient = isIngredient && line.item !== "" && !ingredientOptions.includes(line.item);
                const ingredientChoice = customIngredient ? "__custom__" : line.item;
                const fixedUnit = isIngredient ? ingredientUnits[line.item] : undefined;
                return (
                  <article key={line.id} className="general-purchase-item">
                    <div className="general-purchase-item-head"><strong>รายการซื้อ {index + 1}</strong><span>ยอดรวม ฿{fmt(amount)}</span><button type="button" className="line-delete" aria-label={`ลบรายการ ${index + 1}`} disabled={lines.length === 1} onClick={() => removeLine(line.id)}>ลบ</button></div>
                    <div className="general-purchase-fields">
                      <label className="field">กลุ่มการซื้อ<select aria-label={`กลุ่มการซื้อ ${index + 1}`} value={line.category} onChange={(event) => update(line.id, "category", event.target.value)}><option>วัตถุดิบ</option><option>สินทรัพย์</option><option>ค่าใช้จ่ายอื่น</option></select></label>
                      {isIngredient ? (
                        <label className="field">วัตถุดิบ<select aria-label={`เลือกวัตถุดิบ ${index + 1}`} value={ingredientChoice} onChange={(event) => chooseIngredient(line.id, event.target.value)}><option value="">เลือกวัตถุดิบ</option>{ingredientOptions.map((item) => <option key={item} value={item}>{item}</option>)}<option value="__custom__">+ เพิ่มวัตถุดิบใหม่</option></select>{customIngredient && <input aria-label={`ชื่อวัตถุดิบใหม่ ${index + 1}`} placeholder="พิมพ์ชื่อวัตถุดิบใหม่" value={line.item === "__custom__" ? "" : line.item} onChange={(event) => update(line.id, "item", event.target.value)} />}</label>
                      ) : <label className="field">รายการ<input type="text" aria-label={`รายการซื้อ ${index + 1}`} placeholder="เช่น ตู้เย็น" value={line.item} onChange={(event) => update(line.id, "item", event.target.value)} /></label>}
                      <label className="field">วันที่ซื้อ<input type="date" aria-label={`วันที่ซื้อ ${index + 1}`} value={line.purchaseDate} onChange={(event) => update(line.id, "purchaseDate", event.target.value)} /></label>
                      <label className="field">จำนวน<input type="number" min="0.01" step="0.01" inputMode="decimal" aria-label={`จำนวน ${index + 1}`} placeholder="จำนวน" value={line.quantity} onChange={(event) => update(line.id, "quantity", event.target.value)} /></label>
                      <label className="field">หน่วย<input type="text" aria-label={`หน่วย ${index + 1}`} placeholder="เช่น หลอด, มล., เครื่อง" value={fixedUnit || line.unit} disabled={!!fixedUnit} onChange={(event) => update(line.id, "unit", event.target.value)} /></label>
                      <label className="field">ราคาซื้อ / หน่วย<input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`ราคาต่อหน่วย ${index + 1}`} placeholder="0.00" value={line.unitPrice} onChange={(event) => update(line.id, "unitPrice", event.target.value)} /></label>
                      <label className="field">ผู้จำหน่าย<input type="text" aria-label={`ผู้จำหน่าย ${index + 1}`} placeholder="ผู้ขาย" value={line.supplier} onChange={(event) => update(line.id, "supplier", event.target.value)} /></label>
                      <label className="field">เลขอ้างอิง / ใบเสร็จ<input type="text" aria-label={`ใบเสร็จ ${index + 1}`} placeholder="เลขที่ (ถ้ามี)" value={line.reference} onChange={(event) => update(line.id, "reference", event.target.value)} /></label>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="button-row general-purchase-actions"><button type="button" className="secondary" onClick={addLine}><Plus size={16} /> เพิ่มรายการ</button><span className="notice success">{lines.length} รายการ · ยอดซื้อรวม ฿{fmt(total)}</span></div>
            {error && <div role="alert" className="notice danger">{error}</div>}
          </div>
          <footer>
            <p>กดเพิ่มรายการเพื่อบันทึกได้ต่อเนื่อง</p>
            <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="primary">บันทึก {lines.length} รายการ</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
