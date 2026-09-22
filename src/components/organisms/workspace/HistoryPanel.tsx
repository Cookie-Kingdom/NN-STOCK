"use client";

import { Panel } from "@/components/atoms/Panel";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { EntryDetails } from "@/components/organisms/shared/EntryDetails";
import { EditRequestList } from "@/components/organisms/workspace/EditRequestList";
import { type Database, type Role, visibleEntries } from "@/lib/store";

export function HistoryPanel({
  db,
  role,
  branch,
  hideSales,
  onChanged,
}: {
  db: Database;
  role: Role;
  branch: string;
  /** Account Manager: sales arrive without their money, so they are not edited here. */
  hideSales?: boolean;
  onChanged: (message: string) => void;
}) {
  const list = visibleEntries(db, role, branch);
  // Edits, requests and details are read from what this role may see, never the full log.
  const visible = { ...db, entries: list };
  const voided = new Set(
    db.entries.filter((e) => e.kind === "void").map((e) => e.values.targetId),
  );
  return (
    <div className="grid gap-6">
      <EditRequestList db={visible} role={role} onChanged={onChanged} />
      <Panel>
        <SectionHeading
          title="ประวัติรายการที่บันทึก"
          description="แสดงเฉพาะรายการที่บัญชีนี้มีสิทธิ์เห็น · กดรายการเพื่อดูค่าที่กรอก แก้ไข หรือขอแก้ไข"
        />
        {list.length ? (
          [...list]
            .reverse()
            .map((entry) => (
              <EntryDetails
                key={entry.id}
                entry={entry}
                db={visible}
                role={role}
                branch={branch}
                voided={voided.has(entry.id)}
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
