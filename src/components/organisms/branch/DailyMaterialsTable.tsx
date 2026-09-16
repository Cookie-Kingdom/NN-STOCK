"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Notice } from "@/components/molecules/Notice";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import {
  branchMaterialStock,
  entries,
  materials,
  mutate,
  n,
  type Database,
  type Values,
} from "@/lib/store";

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
  /* A saved day stays editable: staff mistype, and a locked form turns a typo into
   * a support call. The draft starts from what was recorded, and every save is kept
   * as its own entry so the owner can read the corrections in the history. */
  const [draft, setDraft] = useState<Values>(() =>
    Object.fromEntries(
      materials.flatMap((_, i) => [
        ["used" + i, saved ? String(n(saved.values, "used" + i)) : "0"],
        ["actual" + i, saved ? String(n(saved.values, "material" + i)) : ""],
        ["materialReason" + i, saved?.values["materialReason" + i] || ""],
      ]),
    ),
  );
  // Success and error messages share one Notice, so the hook's error slot doubles as it.
  const {
    error: message,
    setError: setMessage,
    run,
  } = useSaveMutation("บันทึกไม่สำเร็จ");
  const opening = (i: number) => branchMaterialStock(db, branch, i, date);
  const used = (i: number) => n(draft, "used" + i);
  const remaining = (i: number) =>
    draft["actual" + i] === "" ? opening(i) - used(i) : n(draft, "actual" + i);

  async function saveMaterials() {
    const next = await run(() => {
      const values: Values = {
        correctionReason: draft.correctionReason || "",
      };
      materials.forEach((_, i) => {
        values["opening" + i] = String(opening(i));
        values["used" + i] = String(used(i));
        values["material" + i] = String(remaining(i));
        values["materialReason" + i] = draft["materialReason" + i] || "";
      });
      return mutate(
        latestDatabase(),
        "branch",
        "materials",
        values,
        "",
        date,
        branch,
      );
    });
    if (next) {
      setDraft((current) => ({ ...current, correctionReason: "" }));
      setMessage("บันทึกการใช้วัสดุวันนี้แล้ว");
    }
  }

  return (
    <>
      <DataTable
        title="วัสดุ 7 รายการ · กรอกการใช้วันนี้"
        columns={[
          "วัสดุ",
          "ยอดตั้งต้น",
          "ใช้วันนี้",
          "ยอดที่ควรเหลือ",
          "ตรวจนับจริง",
          "เหตุผลส่วนต่าง",
          "สถานะ",
        ]}
        action={
          <Button variant="primary" disabled={disabled} onClick={saveMaterials}>
            {saved ? "บันทึกแก้ไข" : "บันทึกการใช้วัสดุ"}
          </Button>
        }
        rowKeys={materials}
        rows={materials.map((item, i) => [
          <strong key={item}>{item}</strong>,
          String(opening(i)),
          <Input
            key={`used-${i}`}
            variant="table"
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
          />,
          String(opening(i) - used(i)),
          <Input
            key={`actual-${i}`}
            variant="table"
            type="number"
            min="0"
            step="1"
            placeholder={String(opening(i) - used(i))}
            value={draft["actual" + i] ?? ""}
            disabled={disabled}
            aria-label={`ยอดตรวจนับจริง ${item}`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                ["actual" + i]: event.target.value,
              }))
            }
          />,
          <Input
            key={`reason-${i}`}
            variant="table"
            reason
            type="text"
            placeholder="กรอกเมื่อยอดไม่ตรง"
            value={draft["materialReason" + i] || ""}
            disabled={disabled || remaining(i) === opening(i) - used(i)}
            aria-label={`เหตุผลส่วนต่าง ${item}`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                ["materialReason" + i]: event.target.value,
              }))
            }
          />,
          saved ? "บันทึกแล้ว" : opening(i) ? "รอบันทึก" : "Owner ยังไม่ตั้งฐาน",
        ])}
      />
      {saved && (
        <Notice>
          บันทึกล่าสุด {new Date(saved.at).toLocaleString("th-TH")} · ครั้งที่{" "}
          {saved.values.revision || "1"} · แก้ไขแล้วบันทึกซ้ำได้
          ทุกครั้งที่บันทึกถูกเก็บไว้ในประวัติให้ Owner ตรวจสอบ
          <Input
            className="mt-2 w-full"
            type="text"
            placeholder="เหตุผลที่แก้ไข เช่น กรอกตัวเลขผิด"
            aria-label="เหตุผลที่แก้ไขยอดวัสดุ"
            value={draft.correctionReason || ""}
            disabled={disabled}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                correctionReason: event.target.value,
              }))
            }
          />
        </Notice>
      )}
      {message && <Notice>{message}</Notice>}
    </>
  );
}
