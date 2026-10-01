"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/atoms/Input";
import { FilterBar } from "@/components/molecules/FilterBar";
import { FormField, PrefillCaption } from "@/components/molecules/FormField";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { ReadOnlyValue } from "@/components/atoms/ReadOnlyValue";
import { SectionAction } from "@/components/molecules/SectionAction";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import {
  materialCountDraft,
  materialOverStock,
  savedMaterialCount,
} from "./materialCount";
import {
  branchMaterialStock,
  materialPar,
  materials,
  mutate,
  n,
  type Database,
  type Values,
} from "@/lib/store";

/** This table is the page's only editable section, so its key is a one-value union. */
type Section = "count";

const savedMessage = "บันทึกการใช้วัสดุวันนี้แล้ว · กลับสู่โหมดดูข้อมูล";

export function DailyMaterialsTable({
  db,
  branch,
  date,
  onDate,
}: {
  db: Database;
  branch: string;
  date: string;
  onDate: (date: string) => void;
}) {
  const saved = savedMaterialCount(db, branch, date);
  /* Locked by default, the way the Owner's ตั้งค่า tables are: the day's figures read
   * as plain text until แก้ไข is pressed, and บันทึกและล็อก puts them back. A saved
   * day stays editable — staff mistype, and a form that locks for good turns a typo
   * into a support call — and every save is kept as its own entry, so the owner can
   * read the corrections in the history. */
  const [editing, setEditing] = useState<Section | null>(null);
  /* Seeded from the server entry, and seeded again whenever one arrives: on แก้ไข
   * from `latestDatabase()`, and on a save from the database the save returned. The
   * locked cells read `saved` directly, so what the table shows after a save is what
   * the server holds and never the draft that was typed. */
  const [draft, setDraft] = useState<Values>(() => materialCountDraft(saved));
  // Success and failure messages share one slot, so the hook's error slot doubles as it.
  const {
    error: message,
    setError: setMessage,
    run,
    saving,
  } = useSaveMutation("บันทึกไม่สำเร็จ");

  const editButton = useRef<HTMLButtonElement>(null);
  const firstCell = useRef<HTMLInputElement>(null);
  const wasEditing = useRef(false);
  /* Focus follows the mode: into the first box to be filled when the table opens,
   * back onto แก้ไข when it locks, so a keyboard never lands back at the top of
   * the page. */
  useEffect(() => {
    if (editing) firstCell.current?.focus();
    else if (wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing !== null;
  }, [editing]);

  const open = editing !== null;
  const opening = (i: number) => branchMaterialStock(db, branch, i, date);
  const savedUsed = (i: number) => (saved ? n(saved.values, "used" + i) : 0);
  const used = (i: number) => n(draft, "used" + i);
  /* What should be left. Using more than the opening is only a warning (stock drifts),
   * and then nothing is expected to be left, not a negative count. */
  const expected = (i: number) => Math.max(0, opening(i) - used(i));
  const remaining = (i: number) =>
    draft["actual" + i] === "" ? expected(i) : n(draft, "actual" + i);

  const values = () => {
    const out: Values = { correctionReason: draft.correctionReason || "" };
    materials.forEach((_, i) => {
      out["opening" + i] = String(opening(i));
      out["used" + i] = String(used(i));
      out["material" + i] = String(remaining(i));
      out["materialReason" + i] = draft["materialReason" + i] || "";
    });
    return out;
  };
  const startEdit = () => {
    setDraft(
      materialCountDraft(savedMaterialCount(latestDatabase(), branch, date)),
    );
    setEditing("count");
    setMessage("");
  };
  const cancel = () => {
    // Back to the figures the table was showing before แก้ไข.
    setDraft(materialCountDraft(saved));
    setEditing(null);
    setMessage("");
  };
  async function saveMaterials() {
    const next = await run(() =>
      mutate(
        latestDatabase(),
        "branch",
        "materials",
        values(),
        "",
        date,
        branch,
      ),
    );
    if (!next) return;
    // Re-seeded from the entry the save produced, not from what was typed: a revision
    // conflict rebuilds the save on the reloaded database, and this is that result.
    setDraft(materialCountDraft(savedMaterialCount(next, branch, date)));
    setEditing(null);
    setMessage(savedMessage);
  }

  return (
    <>
      {open && saved && (
        <Notice tone="warning">
          แก้ไขยอดที่บันทึกไว้แล้ว · ครั้งที่{" "}
          {Number(saved.values.revision || 1) + 1} —
          ทุกครั้งที่บันทึกถูกเก็บไว้ในประวัติให้ Owner ตรวจสอบ
          <FormField
            className="mt-2"
            label="เหตุผลที่แก้ไขยอดวัสดุ"
            hint="เช่น กรอกตัวเลขผิด"
          >
            <Input
              variant="form"
              type="text"
              value={draft.correctionReason || ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  correctionReason: event.target.value,
                }))
              }
            />
          </FormField>
        </Notice>
      )}
      <DataTable
        title="ตรวจนับสต๊อกวัสดุวันนี้"
        columns={[
          "วัสดุ",
          "ยอดตั้งต้น",
          "ใช้วันนี้",
          "ยอดที่ควรเหลือ",
          "ตรวจนับจริง",
          "เหตุผลส่วนต่าง",
          "สถานะ",
        ]}
        numericColumns={["ใช้วันนี้", "ตรวจนับจริง"]}
        action={
          <FilterBar>
            <WorkingDateField
              variant="filter"
              inline
              className="text-body-sm text-text-secondary"
              date={date}
              onDate={onDate}
            />
            <SectionAction
              section="count"
              editing={open ? "count" : null}
              message={message}
              error=""
              saving={saving}
              onCancel={cancel}
              onSave={saveMaterials}
              onStartEdit={startEdit}
              lockedMessage={message}
              editLabel={
                saved
                  ? "แก้ไขยอดนับ (Edit count)"
                  : "ตรวจนับวัสดุวันนี้ (Count)"
              }
              editRef={editButton}
            />
          </FilterBar>
        }
        rowKeys={materials}
        rows={materials.map((item, i) => {
          const rowOverStock = open
            ? materialOverStock(opening(i), used(i))
            : "";
          return [
            <strong key={item}>{item}</strong>,
            String(opening(i)),
            open ? (
              <div key={`used-${i}`} className="flex flex-col items-end gap-1">
                <Input
                  ref={i === 0 ? firstCell : undefined}
                  variant="table"
                  type="number"
                  min="0"
                  step="1"
                  value={draft["used" + i] ?? ""}
                  aria-label={`จำนวนใช้ ${item} วันนี้`}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      ["used" + i]: event.target.value,
                    }));
                    setMessage("");
                  }}
                />
                {/* A warning on the box it belongs to; the save still goes through. */}
                {rowOverStock ? (
                  <small role="status" className="text-caption text-warning">
                    {rowOverStock}
                  </small>
                ) : (
                  saved && (
                    <small className="text-caption text-text-secondary">
                      บันทึกไว้ {savedUsed(i)}
                    </small>
                  )
                )}
              </div>
            ) : (
              <ReadOnlyValue key={`used-${i}`}>
                {saved ? savedUsed(i) : "—"}
              </ReadOnlyValue>
            ),
            String(opening(i) - (open ? used(i) : savedUsed(i))),
            /* Prefilled with ยอดที่ควรเหลือ rather than hinted at with a placeholder:
             * most counts match, so the branch confirms a number instead of copying
             * one. An untouched box is the empty string, so it keeps following
             * จำนวนใช้ as it is typed, and clearing the box hands it back to the
             * system's figure. */
            open ? (
              <div key={`actual-${i}`}>
                <Input
                  variant="table"
                  type="number"
                  min="0"
                  step="1"
                  prefilled={
                    draft["actual" + i] === "" ? "expected" : undefined
                  }
                  value={
                    draft["actual" + i] === ""
                      ? String(expected(i))
                      : (draft["actual" + i] ?? "")
                  }
                  aria-label={`ยอดตรวจนับจริง ${item}`}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ["actual" + i]: event.target.value,
                    }))
                  }
                />
                {draft["actual" + i] === "" && (
                  <PrefillCaption label="ตามยอดที่ควรเหลือ" expected />
                )}
              </div>
            ) : (
              <ReadOnlyValue key={`actual-${i}`}>
                {saved ? n(saved.values, "material" + i) : "—"}
              </ReadOnlyValue>
            ),
            open ? (
              <Input
                key={`reason-${i}`}
                variant="table"
                reason
                type="text"
                placeholder="กรอกเมื่อยอดไม่ตรง"
                value={draft["materialReason" + i] || ""}
                disabled={remaining(i) === expected(i)}
                aria-label={`เหตุผลส่วนต่าง ${item}`}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    ["materialReason" + i]: event.target.value,
                  }))
                }
              />
            ) : (
              saved?.values["materialReason" + i] || "—"
            ),
            saved
              ? "จดแล้ว"
              : opening(i)
                ? "ยังไม่ได้จด"
                : materialPar(db, branch, i)
                  ? "ยังไม่มีวัสดุที่สาขา"
                  : "Owner ยังไม่ตั้งฐาน",
          ];
        })}
      />
      {saved && (
        <Notice>
          จดล่าสุด {new Date(saved.at).toLocaleString("th-TH")} · ครั้งที่{" "}
          {saved.values.revision || "1"} · แก้ไขแล้วบันทึกซ้ำได้
          ทุกครั้งที่บันทึกถูกเก็บไว้ในประวัติให้ Owner ตรวจสอบ
        </Notice>
      )}
    </>
  );
}
