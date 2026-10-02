"use client";

import type { Ref } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";

/**
 * The locked / editing switch a table puts in its action slot: one `แก้ไข` button
 * while the table is locked, `ยกเลิก` + `บันทึกและล็อก` while it is open, and the
 * message the user needs beside the button they just pressed — never below the rows,
 * where a seven-row table pushes it off the screen.
 *
 * `section` is this table's own key and `editing` the one table that is open, so a
 * view with several tables (ConfigView) opens exactly one at a time. A view with a
 * single table passes a one-value union.
 */
export function SectionAction<Section extends string>({
  section,
  editing,
  message,
  error,
  saving,
  onCancel,
  onSave,
  onStartEdit,
  lockedMessage,
  editLabel = "แก้ไข (Edit)",
  saveLabel = "บันทึกและล็อก (Save & lock)",
  cancelLabel = "ยกเลิก (Cancel)",
  busyLabel = "กำลังบันทึก…",
  otherLabel = "กำลังแก้ตารางอื่น",
  editRef,
}: {
  section: Section;
  editing: Section | null;
  message: string;
  /** What the save would be refused for, checked as the user types. Takes the
   *  message's place: while something is wrong, that is the useful thing to read. */
  error: string;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onStartEdit: (section: Section) => void;
  /** Shown beside the edit button while this table is locked — the confirmation of a
   *  save that has just landed, where the user's eyes already are. */
  lockedMessage?: string;
  editLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  /** Label of the edit button while another table on the page is open. */
  otherLabel?: string;
  /** The edit button, so a caller can put focus back on it when the table locks. */
  editRef?: Ref<HTMLButtonElement>;
}) {
  const open = editing === section;
  return (
    <div className="flex items-center gap-3 max-md:justify-between">
      {open && (error || message) && (
        <span
          role={error ? "alert" : undefined}
          className={error ? "text-danger" : undefined}
        >
          {error || message}
        </span>
      )}
      {!open && lockedMessage && (
        <span role="status" className="text-body-sm font-medium text-success">
          {lockedMessage}
        </span>
      )}
      {open ? (
        <>
          <Button size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={saving || !!error}
            icon={saving ? <Spinner /> : undefined}
            onClick={onSave}
          >
            {saving ? busyLabel : saveLabel}
          </Button>
        </>
      ) : (
        <Button
          ref={editRef}
          size="sm"
          className="border-text-primary text-text-primary"
          disabled={editing !== null}
          onClick={() => onStartEdit(section)}
        >
          {editing ? otherLabel : editLabel}
        </Button>
      )}
    </div>
  );
}
