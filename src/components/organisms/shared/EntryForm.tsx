"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { DailySummary } from "@/components/organisms/branch/DailySummary";
import { PackWeightFields } from "@/components/organisms/shared/PackWeightFields";
import { Preview } from "@/components/organisms/shared/Preview";
import { PurchaseOrderDocumentPreview } from "@/components/organisms/shared/PurchaseOrderDocumentPreview";
import { saveAttachment } from "@/lib/attachment-store";
import { defaults, forms } from "@/lib/forms";
import { latestDatabase, migrateLegacyAttachments, saveDatabase } from "@/lib/persistence";
import { balance, centralBagStock, centralStock, cookedRiceStock, entries, mutate, n, produced, readyForChefHouse, roleName, stages, titles, type Database, type Role, type Values } from "@/lib/store";
import { fmt } from "@/lib/format";
import { type Modal } from "@/lib/nav";

export function EntryForm({
  db,
  role,
  date,
  modal,
  onClose,
  onSaved,
}: {
  db: Database;
  role: Role;
  date: string;
  modal: Modal;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const kind = modal.kind;
  const [values, setValues] = useState<Values>(() => {
    const base = kind === "config" ? { ...db.config } : defaults(kind, date);
    const modalLot = db.lots.find((item) => item.id === modal.lotId);
    if (kind === "closeDay") base.time = db.config.closeTime || "22:00";
    if (kind === "dispatch" && modalLot) Object.assign(base, {
      dispatchKg: String(readyForChefHouse(db, modalLot.id)),
      origin: "Foodiva · กรุงเทพฯ",
      destination: "Chef_house · เชียงใหม่",
    });
    if (kind === "smokeOrder" && modalLot) Object.assign(base, {
      rawKg: String(readyForChefHouse(db, modalLot.id)),
    });
    if (kind === "return" && modalLot) Object.assign(base, {
      returnKg: String(produced(db, modalLot.id)),
      origin: "Chef_house · เชียงใหม่",
      destination: "Foodiva · กรุงเทพฯ",
    });
    if (kind === "purchase") Object.assign(base, {
      customerName: db.config.companyName || "",
      customerAddress: db.config.companyAddress || "",
      attention: db.config.attention || "",
      phone: db.config.companyPhone || "",
      taxId: db.config.taxId || "",
      productName: "เนื้อวัว",
    });
    return base;
  });
  const [lotId, setLotId] = useState(modal.lotId);
  const [error, setError] = useState("");
  const attachmentFiles = useRef<Record<string, File>>({});
  const lot = db.lots.find((l) => l.id === lotId);
  const useLot = ["receive", "thaw", "sale", "allocate"].includes(kind);
  const choices = db.lots.filter(
    (l) =>
      l.stage >= 8 &&
      (role === "owner" ||
        entries(db, "allocate", l.id, db.config.branch).length),
  );
  const allocations = entries(db, "allocate", lotId, db.config.branch)
    .map((e) => ({
      entry: e,
      outstanding:
        n(e.values, "kg") -
        entries(db, "receive", lotId, db.config.branch)
          .filter((r) => r.values.allocation === e.id)
          .reduce((s, r) => s + n(r.values, "kg"), 0),
    }))
    .filter((a) => a.outstanding > 0.001);
  const formFields = (forms[kind] || []).filter((field) => {
    if (kind === "smoke" && field.key === "packs") return false;
    if (kind === "supplyPurchase" || kind === "ricePurchase")
      return db.config.branch === "มีนบุรี"
        ? !["rawRiceKg", "rawRiceCost"].includes(field.key)
        : !["cookedRiceKg", "cookedRiceCost"].includes(field.key);
    if (kind === "supplyIssue" && db.config.branch === "มีนบุรี")
      return field.key !== "rawRiceIssuedKg";
    return true;
  });
  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setError("");
  };
  const isPurchaseOrder = kind === "purchase" || kind === "smokeOrder";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const resolvedValues = { ...values };
      for (const key of ["origin", "destination"]) {
        if (resolvedValues[key] === "อื่น ๆ") {
          const custom = resolvedValues[`${key}Custom`]?.trim();
          if (!custom) throw new Error(`กรุณาระบุ${key === "origin" ? "ต้นทาง" : "ปลายทาง"}เอง`);
          resolvedValues[key] = custom;
        }
      }
      for (const [key, file] of Object.entries(attachmentFiles.current)) {
        resolvedValues[`${key}StorageKey`] = await saveAttachment(file);
      }
      const current = await migrateLegacyAttachments(latestDatabase());
      const next = mutate(current, role, kind, resolvedValues, lotId, date);
      saveDatabase(next);
      onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }
  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        className={`form-dialog ${isPurchaseOrder ? "po-preview-dialog" : ""}`}
      >
        <header>
          <div>
            <span className="overline">
              {date} · {roleName[role]}
            </span>
            <h2 id="form-title">
              {kind === "purchase"
                ? "สร้าง PO เนื้อ"
                : kind === "smokeOrder"
                  ? "สร้าง PO โรงรมควัน"
                  : kind === "ricePurchase" && db.config.branch === "ศาลาแดง"
                    ? "ซื้อข้าวเหนียวดิบเข้าสต๊อก · กิโลกรัม"
                  : titles[kind]}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="ปิดฟอร์ม"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className={isPurchaseOrder ? "po-preview-layout" : "form-content"}>
          <div className={`form-body ${isPurchaseOrder ? "po-preview-form" : ""}`}>
            {isPurchaseOrder && (
              <div className="notice po-preview-notice">
                กรอกข้อมูลด้านซ้าย เอกสาร PO ด้านขวาจะเปลี่ยนตามทันที
              </div>
            )}
            {lot && !useLot && (
              <div className="notice">
                {lot.id} · {stages[lot.stage]}
              </div>
            )}
            {useLot && (
              <label className="field">
                Lot ต้นทาง
                <select
                  autoFocus
                  value={lotId}
                  required
                  onChange={(e) => {
                    setLotId(e.target.value);
                    set("allocation", "");
                  }}
                >
                  <option value="">เลือก Lot</option>
                  {choices.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id} ·{" "}
                      {kind === "allocate"
                        ? `${fmt(centralStock(db, l.id))} กก. · ${centralBagStock(db, l.id)} ถุงในคลังกลาง`
                        : `${fmt(balance(db, l.id, db.config.branch).frozen)} แช่แข็ง / ${fmt(balance(db, l.id, db.config.branch).ready)} พร้อมขาย`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {kind === "receive" && (
              <label className="field">
                ใบจัดสรรที่รับ
                <select
                  required
                  value={values.allocation || ""}
                  onChange={(e) => set("allocation", e.target.value)}
                >
                  <option value="">เลือกใบจัดสรร</option>
                  {allocations.map((a) => (
                    <option key={a.entry.id} value={a.entry.id}>
                      {a.entry.date} · ค้างรับ {fmt(a.outstanding)} กก. ·{" "}
                      {a.entry.id.slice(0, 6)}
                    </option>
                  ))}
                </select>
                {!allocations.length && (
                  <small>ยังไม่มีใบจัดสรรค้างรับของ Lot นี้</small>
                )}
              </label>
            )}
            {kind === "closeDay" && (
              <DailySummary db={db} branch={db.config.branch} date={date} />
            )}
            {kind === "smoke" && (
              <div className="notice">
                บันทึกครั้งละ 1 รอบสโมค ระบบจะสร้าง Lot สโมครายวันแยกให้ และเก็บวันที่ จำนวนถุง น้ำหนักถุง และ Waste ใน Log
              </div>
            )}
            {kind === "foodDivaConfirm" && (
              <div className="notice">
                แบ่งน้ำหนักตาม Invoice ให้ครบทุกกิโล: พร้อมส่ง Chef_house ที่เชียงใหม่ + เนื้อส่วนที่เหลือรอ Owner รับ (Waste) ต้องรวมเท่ากับน้ำหนักตาม Invoice
              </div>
            )}
            {kind === "unlock" && (
              <div className="notice warning">
                ปลดล็อกให้เพิ่มรายการแก้ไขของสาขาได้ ประวัติเดิมจะยังอยู่ ยอดขาย
                สต๊อก และรายงานจะคำนวณเพิ่มจากรายการใหม่
              </div>
            )}
            {(kind === "supplyPurchase" || kind === "ricePurchase") &&
              db.config.branch === "มีนบุรี" && (
              <div className="notice">
                ข้าวเหนียวสุกคงเหลือ{" "}
                {fmt(cookedRiceStock(db, db.config.branch))} กก. ·
                ควรซื้อเพิ่มอย่างน้อย{" "}
                {fmt(
                  Math.max(
                    0,
                    n(db.config, "cookedRicePar") -
                      cookedRiceStock(db, db.config.branch),
                  ),
                )}{" "}
                กก. เพื่อให้พร้อมขายไม่น้อยกว่า{" "}
                {fmt(n(db.config, "cookedRicePar"))} กก.
                {cookedRiceStock(db, db.config.branch) <= 0.001
                  ? " · วันแรกปกติซื้อประมาณ 31–33 กก."
                  : " · ระบบหักของเหลือที่นำกลับมาอุ่นแล้ว จึงซื้อวันถัดไปน้อยลงได้"}
              </div>
            )}
            <div className="form-grid">
              {formFields.map((f, index) => (
                <label
                  className={`field ${f.type === "textarea" ? "wide" : ""}`}
                  key={f.key}
                >
                  {f.label}
                  {f.optional && <span className="optional"> (ถ้ามี)</span>}
                  {f.type === "select" ? (
                    <select
                      value={values[f.key] || ""}
                      required={!f.optional}
                      onChange={(e) => set(f.key, e.target.value)}
                    >
                      {f.options!.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "location" ? (
                    <>
                      <select
                        value={values[f.key] || ""}
                        required
                        onChange={(e) => set(f.key, e.target.value)}
                      >
                        {f.options!.map((o) => <option key={o}>{o}</option>)}
                      </select>
                      {values[f.key] === "อื่น ๆ" && (
                        <input
                          autoFocus
                          placeholder="พิมพ์จังหวัด / จุดส่งเอง"
                          value={values[`${f.key}Custom`] || ""}
                          onChange={(e) => set(`${f.key}Custom`, e.target.value)}
                        />
                      )}
                    </>
                  ) : f.type === "file" ? (
                    <div className="file-upload-control">
                      <input
                        type="file"
                        accept={f.accept}
                        required={!f.optional}
                        onChange={(e) => {
                          const file = e.currentTarget.files?.[0];
                          if (!file) {
                            set(f.key, "");
                            delete attachmentFiles.current[f.key];
                            return;
                          }
                          if (file.size > 2 * 1024 * 1024) {
                            setError("ไฟล์ Invoice ต้องมีขนาดไม่เกิน 2 MB");
                            e.currentTarget.value = "";
                            return;
                          }
                          attachmentFiles.current[f.key] = file;
                          set(f.key, file.name);
                        }}
                      />
                      {values[f.key] && (
                        <span className="file-uploaded">เลือกแล้ว: {values[f.key]}</span>
                      )}
                    </div>
                  ) : f.type === "textarea" ? (
                    <textarea
                      className={f.key === "note" ? "compact-note" : undefined}
                      required={!f.optional}
                      rows={f.key === "packs" ? 5 : f.key === "note" ? 1 : 3}
                      value={values[f.key] || ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      autoFocus={index === 0 && !useLot}
                      type={f.type === "time" ? "text" : f.type || "text"}
                      placeholder={f.type === "time" ? "08:00" : undefined}
                      pattern={
                        f.type === "time"
                          ? "([01][0-9]|2[0-3]):[0-5][0-9]"
                          : undefined
                      }
                      inputMode={f.type === "number" ? "decimal" : undefined}
                      min={
                        f.type === "number"
                          ? f.zero
                            ? 0
                            : f.integer
                              ? 1
                              : 0.01
                          : undefined
                      }
                      step={
                        f.type === "number"
                          ? f.integer
                            ? 1
                            : f.key === "packKg"
                              ? 0.001
                              : 0.01
                          : undefined
                      }
                      max={f.key === "tolerance" ? 100 : undefined}
                      required={!f.optional}
                      value={values[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}
                  {f.hint && <small>{f.hint}</small>}
                </label>
              ))}
              {kind === "smoke" && (
                <PackWeightFields
                  value={values.packs || ""}
                  onChange={(value) => set("packs", value)}
                />
              )}
            </div>
            {!isPurchaseOrder && kind !== "cmReceive" && <Preview db={db} lot={lot} kind={kind} v={values} />}
            {error && (
              <div role="alert" className="notice danger">
                {error}
              </div>
            )}
          </div>
          {isPurchaseOrder && (
            <PurchaseOrderDocumentPreview
              db={db}
              lot={lot}
              kind={kind}
              values={values}
              date={date}
            />
          )}
          </div>
          <footer>
            <p>{isPurchaseOrder ? "ตรวจ Preview ก่อนบันทึก PO" : kind === "smokingInvoice" ? "ระบบจะคำนวณยอดตาม PO ให้ Owner ตรวจหลัง Submit" : "บันทึกแล้วเก็บในเบราว์เซอร์"}</p>
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button className="primary" type="submit">
              {kind === "closeDay"
                ? "ยืนยันปิดวัน"
                : kind === "purchase"
                  ? "บันทึก PO เนื้อ"
                  : kind === "smokeOrder"
                    ? "บันทึก PO โรงรมควัน"
                    : kind === "smokingInvoice"
                      ? "Submit ใบวางบิล"
                    : kind === "dispatch"
                      ? "สร้างใบขนส่งขาไป"
                      : kind === "return"
                        ? "สร้างใบขนส่งขากลับ"
                    : "บันทึกรายการ"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
