"use client";

import { Panel } from "@/components/atoms/Panel";
import { Muted } from "@/components/atoms/Text";
import { EmptyState } from "@/components/molecules/EmptyState";
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
      <h2 className="mb-3 text-h2">ประวัติรายการที่บันทึก</h2>
      <Muted>
        แสดงเฉพาะรายการที่บัญชีนี้มีสิทธิ์เห็น · กดรายการเพื่อดูค่าที่กรอก
      </Muted>
      {list.length ? (
        [...list]
          .reverse()
          .map((entry) => (
            <EntryDetails
              key={entry.id}
              entry={entry}
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
