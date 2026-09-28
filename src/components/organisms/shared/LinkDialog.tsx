"use client";

import { useState } from "react";
import { ReadRow } from "@/components/atoms/ReadRow";
import { Select } from "@/components/atoms/Select";
import { FormField } from "@/components/molecules/FormField";
import { Notice } from "@/components/molecules/Notice";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import {
  entryName,
  lotName,
} from "@/components/organisms/shared/entryReferences";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import {
  centralStock,
  check,
  entries,
  mutate,
  n,
  shipments,
  titles,
  type Database,
  type Entry,
  type Role,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";

/** The choices a `link` on `target` can point at: shipment batches for branch meat, the
 *  branch's material transfers no other receipt has taken for a material receipt (LNK-02). */
export function linkChoices(db: Database, target: Entry) {
  if (target.kind === "materialConfirm") {
    const taken = new Set(
      entries(db, "materialConfirm")
        .filter((c) => c.id !== target.id)
        .map((c) => c.values.transferId)
        .filter(Boolean),
    );
    return entries(db, "materialTransfer", undefined, target.branch)
      .filter((t) => !taken.has(t.id))
      .reverse()
      .map((t) => ({
        value: t.id,
        label: entryName(db, t.id) || t.id,
      }));
  }
  return shipments(db)
    .slice()
    .reverse()
    .map((lot) => {
      const central = n(lot.values, "centralKg") > 0;
      return {
        value: lot.id,
        label: `${lotName(db, lot.id)}${
          central
            ? ` · สต๊อกกลางคงเหลือ ${fmt(centralStock(db, lot.id))} กก.`
            : " · ยังไม่เข้าสต๊อกกลาง"
        }`,
      };
    });
}

/** LNK-06: tie an entry recorded without its source to a shipment batch (branch meat) or a
 *  material transfer (materialConfirm) after the fact. Saves one `link`; the entry itself is
 *  never rewritten, and a later link wins (LNK-05). */
export function LinkDialog({
  entry,
  db,
  role,
  branch = "",
  onClose,
  onLinked,
}: {
  /** The target, with any earlier link already overlaid (from `entries()`). */
  entry: Entry;
  /** What the choices are read from: every batch / transfer this account can see. */
  db: Database;
  role: Role;
  branch?: string;
  onClose: () => void;
  onLinked: (message: string) => void;
}) {
  const material = entry.kind === "materialConfirm";
  const current = material ? entry.values.transferId || "" : entry.lotId;
  const choices = linkChoices(db, entry);
  const [value, setValue] = useState(current);
  const [error, setError] = useState("");
  const save = () => {
    setError("");
    let next: Database | undefined;
    const { warnings, error } = check(() => {
      next = mutate(
        latestDatabase(),
        role,
        "link",
        material
          ? { targetId: entry.id, transferId: value }
          : { targetId: entry.id, lotId: value },
        "",
        today(),
        branch,
      );
    });
    if (!next) return setError(error || "ผูกรายการไม่สำเร็จ");
    saveDatabase(next);
    onLinked(
      [
        material
          ? "ผูกกับใบส่งวัสดุแล้ว"
          : `ผูกกับ ${lotName(db, value)} แล้ว · ยอดคงเหลือและต้นทุนคำนวณใหม่ตามชุดนี้`,
        ...warnings,
      ].join(" · "),
    );
  };
  return (
    <Dialog
      title={material ? "ผูกกับใบส่งวัสดุ" : "ผูกกับชุดรมควัน"}
      overline={titles.link}
      size="document"
      onClose={onClose}
    >
      <form
        className="flex min-h-0 flex-auto flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <DialogBody>
          <ReadRow
            label="รายการ"
            value={entryName(db, entry.id) || titles[entry.kind]}
          />
          <ReadRow
            label="ผูกอยู่กับ"
            value={
              material
                ? current
                  ? entryName(db, current) || "—"
                  : "ยังไม่ผูกใบส่งวัสดุ"
                : lotName(db, current)
            }
          />
          <Notice>
            {material
              ? "เลือกใบส่งวัสดุจาก Owner ที่ตรงกับของที่รับ · จำนวนวัสดุที่สาขาไม่เปลี่ยน"
              : "เลือกชุดรมควันของเนื้อนี้ · ยอดคงเหลือย้ายจาก “ไม่ระบุ Lot” ไปชุดที่เลือก และต้นทุนยอดขายคิดตามชุดนั้น"}
          </Notice>
          <FormField label={material ? "ใบส่งวัสดุ" : "ชุดรมควัน (Lot S)"} wide>
            <Select
              data-autofocus
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <option value="" disabled>
                {choices.length
                  ? "เลือก…"
                  : material
                    ? "ไม่มีใบส่งวัสดุที่ยังไม่ถูกยืนยัน"
                    : "ยังไม่มีชุดรมควัน"}
              </option>
              {choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </Select>
          </FormField>
        </DialogBody>
        <DialogFooter
          hint="ทุกการผูกเก็บเป็นประวัติ Owner ตรวจย้อนหลังได้"
          error={error}
          onCancel={onClose}
          submitLabel="บันทึกการผูก"
          submitDisabled={!value || value === current}
        />
      </form>
    </Dialog>
  );
}
