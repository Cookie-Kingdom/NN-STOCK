"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import { materials, mutate, n, ownerMaterialStock, type Database, type Values } from "@/lib/store";
import { fmt } from "@/lib/format";

export function MaterialPurchaseForm({
  db,
  date,
  onClose,
  onSaved,
}: {
  db: Database;
  date: string;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const purchaseLines = [
    ...materials.map((material) => ({
      key: `material-${material}`,
      label: material,
      unit: "ชิ้น",
    })),
  ];
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Values>({});
  const [unitPrices, setUnitPrices] = useState<Values>({});
  const [purchaseDates, setPurchaseDates] = useState<Values>({});
  const [suppliers, setSuppliers] = useState<Values>({});
  const [references, setReferences] = useState<Values>({});
  const [error, setError] = useState("");
  const selected = purchaseLines.filter((line) => checked[line.key]);
  const total = selected.reduce(
    (sum, line) => sum + n(quantities, line.key) * n(unitPrices, line.key),
    0,
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!selected.length) throw new Error("ติ๊กเลือกอย่างน้อย 1 รายการ");
      let next = latestDatabase();
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
          { purchaseDate, material: item, quantity: String(quantity), unitPrice: String(unitPrice), supplier, reference },
          "",
          purchaseDate,
        );
      }
      saveDatabase(next);
      onSaved(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกการซื้อวัสดุไม่สำเร็จ");
    }
  }

  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="material-purchase-title" className="form-dialog material-transfer-dialog material-purchase-dialog">
        <header>
          <div>
            <span className="overline">Owner · สต๊อกวัสดุ</span>
            <h2 id="material-purchase-title">ซื้อวัสดุเข้าคลัง</h2>
          </div>
          <button type="button" className="icon-button" aria-label="ปิดฟอร์ม" onClick={onClose}><X /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-body">
            <div className="notice">ติ๊กวัสดุที่ซื้อ แล้วกรอกวันที่ซื้อ ผู้จำหน่าย และเลขอ้างอิงของรายการนั้นเอง ระบบจะเพิ่มจำนวนเข้า Owner Stock</div>
            <div className="material-purchase-list">
              {purchaseLines.map((line) => {
                const selectedRow = !!checked[line.key];
                const amount = n(quantities, line.key) * n(unitPrices, line.key);
                return (
                  <article key={line.key} className={`material-purchase-item ${selectedRow ? "selected-row" : ""}`}>
                    <label className="material-purchase-toggle">
                      <input type="checkbox" aria-label={`ซื้อ ${line.label}`} checked={selectedRow} onChange={(event) => { setChecked((current) => ({ ...current, [line.key]: event.target.checked })); setError(""); }} />
                      <span><strong>{line.label}</strong><small>คงคลัง Owner {fmt(ownerMaterialStock(db, line.label))} ชิ้น</small></span>
                      <b>{selectedRow ? `ยอดซื้อ ฿${fmt(amount)}` : "ติ๊กเพื่อกรอก"}</b>
                    </label>
                    {selectedRow && (
                      <div className="material-purchase-fields">
                        <label className="field">วันที่ซื้อ<input type="date" aria-label={`วันที่ซื้อ ${line.label}`} value={purchaseDates[line.key] ?? date} onChange={(event) => setPurchaseDates((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                        <label className="field">จำนวนที่ซื้อ<input type="number" min="1" step="1" inputMode="numeric" aria-label={`จำนวนซื้อ ${line.label}`} placeholder="จำนวน" value={quantities[line.key] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                        <label className="field">ราคาซื้อ / หน่วย<input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`ราคาซื้อ ${line.label}`} placeholder="0.00" value={unitPrices[line.key] || ""} onChange={(event) => setUnitPrices((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                        <label className="field">ผู้จำหน่าย<input type="text" aria-label={`ผู้จำหน่าย ${line.label}`} placeholder="ผู้ขาย" value={suppliers[line.key] || ""} onChange={(event) => setSuppliers((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                        <label className="field">เลขอ้างอิง / ใบเสร็จ<input type="text" aria-label={`ใบเสร็จ ${line.label}`} placeholder="เลขที่ (ถ้ามี)" value={references[line.key] || ""} onChange={(event) => setReferences((current) => ({ ...current, [line.key]: event.target.value }))} /></label>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="notice success material-purchase-summary">เลือก {selected.length} รายการ · ยอดซื้อรวม ฿{fmt(total)}</div>
            {error && <div role="alert" className="notice danger">{error}</div>}
          </div>
          <footer>
            <p>บันทึกครั้งเดียวได้หลายวัสดุ</p>
            <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="primary">บันทึกการซื้อ {selected.length ? `${selected.length} รายการ` : ""}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
