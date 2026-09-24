import type { Notification } from "@/components/organisms/workspace/NotificationPopover";
import { today } from "@/lib/format";
import {
  editApprovers,
  editDecisions,
  editRequestRows,
  entryBy,
  titles,
  visibleEntries,
  type Database,
  type Entry,
  type Role,
  type EntryKind,
} from "@/lib/store";

/** Result wording the requester sees, in the list and at the bell (spec 8.1). */
export const editOutcome = (decision?: Entry) =>
  !decision
    ? "รอพิจารณา"
    : decision.values.decision === editDecisions.approve
      ? "สำเร็จ"
      : "ไม่สำเร็จ";

/** Bell items about edit requests, derived from the log. An approver gets one line with the
 *  waiting count; a requester gets each own request still waiting, and each decided in the
 *  last 7 days with สำเร็จ / ไม่สำเร็จ. All of them open the history tab, where the list is.
 *  ponytail: no "seen" marker, a decision drops off after 7 days; add one if that is noisy. */
export function editRequestAlerts(
  db: Database,
  role: Role,
  branch: string,
  now = today(),
): Notification[] {
  const rows = editRequestRows({
    ...db,
    entries: visibleEntries(db, role, branch),
  });
  if (editApprovers.includes(role)) {
    const waiting = rows.filter((row) => !row.decision).length;
    return waiting
      ? [
          {
            title: `คำขอแก้ไขรอพิจารณา ${waiting} รายการ`,
            detail: "ดูค่าเดิม ค่าใหม่ และเหตุผล แล้วอนุมัติหรือไม่อนุมัติ",
            tab: "history" as const,
          },
        ]
      : [];
  }
  const since = new Date(Date.parse(now) - 7 * 864e5)
    .toISOString()
    .slice(0, 10);
  return rows
    .filter(({ decision }) => !decision || decision.date >= since)
    .map(({ request, decision }) => ({
      title: `คำขอแก้ไข${editOutcome(decision)} · ${titles[request.values.targetKind as EntryKind] || request.values.targetKind} ${request.values.targetDate}`,
      detail: decision
        ? `${entryBy(decision)} ${decision.values.decision}${decision.values.note ? ` · ${decision.values.note}` : ""}`
        : "รอพิจารณา · ค่าจะเปลี่ยนเมื่ออนุมัติแล้ว",
      tab: "history" as const,
    }));
}
