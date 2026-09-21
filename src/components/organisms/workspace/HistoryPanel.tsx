"use client";

import { Panel } from "@/components/atoms/Panel";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { EntryDetails } from "@/components/organisms/shared/EntryDetails";
import { type Database, type Role, visibleEntries } from "@/lib/store";

export function HistoryPanel({
  db,
  role,
  branch,
  onChanged,
}: {
  db: Database;
  role: Role;
  branch: string;
  onChanged: (message: string) => void;
}) {
  const list = visibleEntries(db, role, branch);
  const voided = new Set(
    db.entries.filter((e) => e.kind === "void").map((e) => e.values.targetId),
  );
  return (
    <Panel>
      <SectionHeading
        title="ประวัติรายการที่บันทึก"
        description="แสดงเฉพาะรายการที่บัญชีนี้มีสิทธิ์เห็น · กดรายการเพื่อดูค่าที่กรอก"
      />
      {list.length ? (
        [...list]
          .reverse()
          .map((entry) => (
            <EntryDetails
              key={entry.id}
              entry={entry}
              db={db}
              owner={role === "owner"}
              voided={voided.has(entry.id)}
              onChanged={onChanged}
            />
          ))
      ) : (
        <EmptyState text="ยังไม่มีประวัติ" />
      )}
    </Panel>
  );
}
