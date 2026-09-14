"use client";

import { EntryDetails } from "@/components/organisms/shared/EntryDetails";
import { Empty } from "@/components/shared/primitives";
import { type Database, type Role, visibleEntries } from "@/lib/store";

export function HistoryPanel({
  db,
  role,
  onChanged,
}: {
  db: Database;
  role: Role;
  onChanged: (message: string) => void;
}) {
  const list = visibleEntries(db, role);
  return (
    <section className="panel">
      <h2>ประวัติรายการที่บันทึก</h2>
      <p className="muted">แสดงเฉพาะรายการที่บัญชีนี้มีสิทธิ์เห็น · กดรายการเพื่อดูค่าที่กรอก</p>
      {list.length ? (
        [...list]
          .reverse()
          .map((entry) => (
            <EntryDetails key={entry.id} entry={entry} owner={role === "owner"} onChanged={onChanged} />
          ))
      ) : (
        <Empty text="ยังไม่มีประวัติ" />
      )}
    </section>
  );
}
