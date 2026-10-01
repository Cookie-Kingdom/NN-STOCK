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
  mutate,
  n,
  shipments,
  titles,
  type Database,
  type Entry,
  type ActingRole,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";

/** The choices a `link` can point at: the shipment batches (LNK-02). */
function linkChoices(db: Database) {
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

/** LNK-06: tie branch meat recorded without its source to a shipment batch after the fact.
 *  Saves one `link`; the entry itself is never rewritten, and a later link wins (LNK-05). */
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
  /** What the choices are read from: every batch this account can see. */
  db: Database;
  role: ActingRole;
  branch?: string;
  onClose: () => void;
  onLinked: (message: string) => void;
}) {
  const current = entry.lotId;
  const choices = linkChoices(db);
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
        { targetId: entry.id, lotId: value },
        "",
        today(),
        branch,
      );
    });
    if (!next) return setError(error || "ผูกรายการไม่สำเร็จ");
    saveDatabase(next);
    onLinked(
      [
        `ผูกกับ ${lotName(db, value)} แล้ว · ยอดคงเหลือและต้นทุนคำนวณใหม่ตามชุดนี้`,
        ...warnings,
      ].join(" · "),
    );
  };
  return (
    <Dialog
      title="ผูกกับชุดรมควัน"
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
          <ReadRow label="ผูกอยู่กับ" value={lotName(db, current)} />
          <Notice>
            เลือกชุดรมควันของเนื้อนี้ · ยอดคงเหลือย้ายจาก “ไม่ระบุ Lot”
            ไปชุดที่เลือก และต้นทุนยอดขายคิดตามชุดนั้น
          </Notice>
          <FormField label="ชุดรมควัน (Lot S)" wide>
            <Select
              data-autofocus
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <option value="" disabled>
                {choices.length ? "เลือก…" : "ยังไม่มีชุดรมควัน"}
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
