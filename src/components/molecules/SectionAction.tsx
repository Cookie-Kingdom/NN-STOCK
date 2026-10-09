"use client";

import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils";

/**
 * The locked / editing switch a Settings section puts in its title bar: one `แก้ไข` button
 * while the section is locked, `ยกเลิก` + `บันทึก` while it is open, and the message the
 * user reads beside the button they just pressed, never below the rows.
 *
 * `section` is this section's own key and `editing` the one section that is open, so a page
 * with several sections opens exactly one at a time.
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
}: {
  section: Section;
  editing: Section | null;
  message: string;
  /** Why the save was refused. Takes the message's place. */
  error: string;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onStartEdit: (section: Section) => void;
}) {
  const open = editing === section;
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      {open && (error || message) && (
        <span
          role={error ? "alert" : undefined}
          className={cn("text-body-sm", error && "text-danger")}
        >
          {error || message}
        </span>
      )}
      {open ? (
        <>
          <Button size="sm" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={saving || !!error}
            icon={saving ? <Spinner /> : undefined}
            onClick={onSave}
          >
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          disabled={editing !== null}
          onClick={() => onStartEdit(section)}
        >
          {editing ? "กำลังแก้ส่วนอื่น" : "แก้ไข"}
        </Button>
      )}
    </div>
  );
}
