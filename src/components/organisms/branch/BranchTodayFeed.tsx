"use client";

import { Panel } from "@/components/atoms/Panel";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { EntryDetails } from "@/components/organisms/shared/EntryDetails";
import { visibleEntries, type Database } from "@/lib/store";

/** จดแล้ววันนี้: what this branch jotted for `date`, newest first, so a save is seen to
 *  have landed. The rows are the Log's own (`EntryDetails`, fed as `HistoryPanel` feeds
 *  them), cut down to the branch's own entries of the working date. */
export function BranchTodayFeed({
  db,
  branch,
  date,
  onChanged,
}: {
  db: Database;
  branch: string;
  date: string;
  onChanged: (message: string) => void;
}) {
  const mine = visibleEntries(db, "branch", branch);
  const visible = { ...db, entries: mine };
  // The log is append-only, so reversed is newest first.
  const list = mine
    .filter(
      (e) => e.role === "branch" && e.branch === branch && e.date === date,
    )
    .reverse();
  return (
    <Panel>
      <SectionHeading
        title="จดแล้ววันนี้"
        description={`วันที่ ${date} · ${list.length} รายการ · ล่าสุดอยู่บนสุด · กดรายการเพื่อดูรายละเอียด`}
      />
      {list.length ? (
        list.map((entry) => (
          <EntryDetails
            key={entry.id}
            entry={entry}
            db={visible}
            lookup={db}
            role="branch"
            branch={branch}
            onChanged={onChanged}
          />
        ))
      ) : (
        <EmptyState compact text="ยังไม่มีรายการของวันนี้" />
      )}
    </Panel>
  );
}
