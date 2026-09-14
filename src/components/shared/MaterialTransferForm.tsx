"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import { branches, materials, mutate, ownerMaterialStock, type Database, type Values } from "@/lib/store";

export function MaterialTransferForm({
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
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Values>({});
  const [receivers, setReceivers] = useState<Values>({});
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const key = (index: number, branch: string) => `${index}-${branch}`;
  const selectedFor = (branch: string) =>
    materials.some((_, index) => checked[key(index, branch)]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
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
      saveDatabase(next);
      onSaved(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="transfer-title" className="form-dialog material-transfer-dialog">
        <header>
          <div>
            <span className="overline">{date} · Owner</span>
            <h2 id="transfer-title">ส่งวัสดุไปสาขา</h2>
          </div>
          <button type="button" className="icon-button" aria-label="ปิดฟอร์ม" onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="form-body">
            <div className="notice">ติ๊กสาขาที่ต้องการส่ง แล้วกรอกจำนวน สามารถเลือกหลายรายการและบันทึกพร้อมกันได้</div>
            <div className="table-scroll transfer-table">
              <table>
                <thead>
                  <tr>
                    <th>วัสดุ</th>
                    <th>คลัง Owner</th>
                    {branches.map((branch) => <th key={branch}>{branch}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material, index) => (
                    <tr key={material}>
                      <td><strong>{material}</strong></td>
                      <td>{ownerMaterialStock(db, material)} ชิ้น</td>
                      {branches.map((branch) => {
                        const field = key(index, branch);
                        return (
                          <td key={branch}>
                            <div className="transfer-cell">
                              <input
                                type="checkbox"
                                aria-label={`ส่ง ${material} ไป${branch}`}
                                checked={!!checked[field]}
                                onChange={(event) => {
                                  setChecked((current) => ({ ...current, [field]: event.target.checked }));
                                  setError("");
                                }}
                              />
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="จำนวน"
                                aria-label={`จำนวน ${material} ไป${branch}`}
                                disabled={!checked[field]}
                                value={quantities[field] || ""}
                                onChange={(event) => setQuantities((current) => ({ ...current, [field]: event.target.value }))}
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
            <div className="form-grid transfer-meta">
              {branches.map((branch) => (
                <label className="field" key={branch}>
                  ผู้รับของสาขา{branch}
                  <input
                    value={receivers[branch] || ""}
                    disabled={!selectedFor(branch)}
                    required={selectedFor(branch)}
                    onChange={(event) => setReceivers((current) => ({ ...current, [branch]: event.target.value }))}
                  />
                </label>
              ))}
              <label className="field">
                เลขที่ใบส่งของ (ถ้ามี)
                <input value={reference} onChange={(event) => setReference(event.target.value)} />
              </label>
              <label className="field">
                หมายเหตุ (ถ้ามี)
                <input value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
            {error && <div role="alert" className="notice danger">{error}</div>}
          </div>
          <footer>
            <p>ทุกรายการจะบันทึกพร้อมกัน</p>
            <button type="button" className="secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="primary">บันทึกส่งวัสดุ</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
