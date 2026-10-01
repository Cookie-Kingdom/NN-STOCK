"use client";

import { Panel } from "@/components/atoms/Panel";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { EntryDetails } from "@/components/organisms/shared/EntryDetails";
import { ChangeLog } from "@/components/organisms/workspace/ChangeLog";
import { type Database, type ActingRole, visibleEntries } from "@/lib/store";

export function HistoryPanel({
  db,
  role,
  branch,
  hideSales,
  onChanged,
}: {
  db: Database;
  role: ActingRole;
  branch: string;
  /** Account Manager: sales arrive without their money, so they are not edited here. */
  hideSales?: boolean;
  onChanged: (message: string) => void;
}) {
  const list = visibleEntries(db, role, branch);
  // Edits and details are read from what this role may see, never the full log.
  const visible = { ...db, entries: list };
  return (
    <div className="grid gap-6">
      <ChangeLog db={db} role={role} branch={branch} onChanged={onChanged} />
      <Panel>
        <SectionHeading
          title="ประวัติรายการที่บันทึก"
          description="แสดงเฉพาะรายการที่บัญชีนี้มีสิทธิ์เห็น · กดรายการเพื่อดูค่าที่กรอก แก้ไข หรือลบ"
        />
        {list.length ? (
          [...list]
            .reverse()
            .map((entry) => (
              <EntryDetails
                key={entry.id}
                entry={entry}
                db={visible}
                lookup={db}
                role={role}
                branch={branch}
                hideSales={hideSales}
                onChanged={onChanged}
              />
            ))
        ) : (
          <EmptyState text="ยังไม่มีประวัติ" />
        )}
      </Panel>
    </div>
  );
}
