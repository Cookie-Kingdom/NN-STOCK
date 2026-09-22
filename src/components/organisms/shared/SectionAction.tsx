"use client";

import type { ReactNode, Ref } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";

/**
 * A figure shown while its table is locked: real text, not a disabled input, so a
 * screen reader, a text search and a copied page all read the value.
 */
export function ReadOnlyValue({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block min-w-28 py-0.5 text-right font-semibold text-text-secondary">
      {children}
    </span>
  );
}

/**
 * The locked / editing switch a table puts in its action slot: one `ขอแก้ไข` button
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
  editLabel = "ขอแก้ไข (Request edit)",
  saveLabel = "บันทึกและล็อก (Save & lock)",
  busyLabel = "กำลังบันทึก…",
  otherLabel = "กำลังแก้ตารางอื่น",
  disabled = false,
  disabledLabel,
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
  busyLabel?: string;
  /** Label of the edit button while another table on the page is open. */
  otherLabel?: string;
  /** This table cannot be edited at all (a closed day); `disabledLabel` says why. */
  disabled?: boolean;
  disabledLabel?: string;
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
            ยกเลิก (Cancel)
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
          disabled={disabled || editing !== null}
          onClick={() => onStartEdit(section)}
        >
          {disabled
            ? (disabledLabel ?? editLabel)
            : editing
              ? otherLabel
              : editLabel}
        </Button>
      )}
    </div>
  );
}
