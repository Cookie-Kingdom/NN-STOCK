"use client";

import { useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import { branchMaterialStock, entries, materials, mutate, n, type Database, type Values } from "@/lib/store";

export function DailyMaterialsTable({
  db,
  branch,
  date,
  disabled,
}: {
  db: Database;
  branch: string;
  date: string;
  disabled: boolean;
}) {
  const saved = entries(db, "materials", undefined, branch, date).at(-1);
  const [draft, setDraft] = useState<Values>(() =>
    Object.fromEntries(
      materials.flatMap((_, i) => [
        ["used" + i, "0"],
        ["actual" + i, ""],
        ["materialReason" + i, ""],
      ]),
    ),
  );
  const [message, setMessage] = useState("");
  const opening = (i: number) =>
    saved
      ? n(saved.values, "opening" + i)
      : branchMaterialStock(db, branch, i, date);
  const used = (i: number) =>
    saved ? n(saved.values, "used" + i) : n(draft, "used" + i);
  const remaining = (i: number) =>
    saved
      ? n(saved.values, "material" + i)
      : draft["actual" + i] === ""
        ? opening(i) - used(i)
        : n(draft, "actual" + i);

  function saveMaterials() {
    try {
      const values: Values = {};
      materials.forEach((_, i) => {
        values["opening" + i] = String(opening(i));
        values["used" + i] = String(used(i));
        values["material" + i] = String(remaining(i));
        values["materialReason" + i] = draft["materialReason" + i] || "";
      });
      const next = mutate(
        latestDatabase(),
        "branch",
        "materials",
        values,
        "",
        date,
      );
      saveDatabase(next);
      setMessage("บันทึกการใช้วัสดุวันนี้แล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <>
      <DataTable
        title="วัสดุ 7 รายการ · กรอกการใช้วันนี้"
        columns={["วัสดุ", "ยอดตั้งต้น", "ใช้วันนี้", "ยอดที่ควรเหลือ", "ตรวจนับจริง", "เหตุผลส่วนต่าง", "สถานะ"]}
        action={
          <button
            className="primary"
            disabled={disabled || !!saved}
            onClick={saveMaterials}
          >
            {saved ? "บันทึกแล้ว" : "บันทึกการใช้วัสดุ"}
          </button>
        }
        rows={materials.map((item, i) => [
          <strong key={item}>{item}</strong>,
          String(opening(i)),
          saved ? (
            String(used(i))
          ) : (
            <input
              key={`used-${i}`}
              className="table-edit-control"
              type="number"
              min="0"
              max={opening(i)}
              step="1"
              value={draft["used" + i] || "0"}
              disabled={disabled}
              aria-label={`จำนวนใช้ ${item} วันนี้`}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  ["used" + i]: event.target.value,
                }));
                setMessage("");
              }}
            />
          ),
          String(opening(i) - used(i)),
          saved ? String(remaining(i)) : (
            <input
              key={`actual-${i}`}
              className="table-edit-control"
              type="number"
              min="0"
              step="1"
              placeholder={String(opening(i) - used(i))}
              value={draft["actual" + i] ?? ""}
              disabled={disabled}
              aria-label={`ยอดตรวจนับจริง ${item}`}
              onChange={(event) => setDraft((current) => ({
                ...current,
                ["actual" + i]: event.target.value,
              }))}
            />
          ),
          saved ? (saved.values["materialReason" + i] || "—") : (
            <input
              key={`reason-${i}`}
              className="table-edit-control reason-control"
              type="text"
              placeholder="กรอกเมื่อยอดไม่ตรง"
              value={draft["materialReason" + i] || ""}
              disabled={disabled || remaining(i) === opening(i) - used(i)}
              aria-label={`เหตุผลส่วนต่าง ${item}`}
              onChange={(event) => setDraft((current) => ({
                ...current,
                ["materialReason" + i]: event.target.value,
              }))}
            />
          ),
          saved ? "บันทึกแล้ว" : opening(i) ? "รอบันทึก" : "Owner ยังไม่ตั้งฐาน",
        ])}
      />
      {message && <div className="notice">{message}</div>}
    </>
  );
}
