"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Panel } from "@/components/atoms/Panel";
import { ReadRow } from "@/components/atoms/ReadRow";
import { DayCard } from "@/components/molecules/DayCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { NoteRow } from "@/components/organisms/shared/NoteRow";
import { noteTags, timeOf } from "@/components/organisms/shared/noteText";
import { ChangeLog } from "@/components/organisms/workspace/ChangeLog";
import { TodoBox } from "@/components/organisms/workspace/TodoBox";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty, thaiDay } from "@/lib/format";
import {
  branchMeat,
  branches,
  hasSale,
  isNoteKind,
  kindInfo,
  missingText,
  visibleNotes,
} from "@/lib/store";
import { cn } from "@/lib/utils";

type Filter = "all" | "missing" | "lot" | "money" | "branch";

const dayBack = (today: string, back: number) =>
  new Date(Date.parse(today) - back * 86400000).toISOString().slice(0, 10);

/** Every note the account sees, one card per day, newest day first: the last 7 days, and 7
 *  more with each press of 「ดูย้อนหลังอีก 7 วัน」. A page for looking: nothing here opens a
 *  new note, only a row its edit or delete. A day's head says per branch whether its sale is
 *  jotted; a day with one missing is yellow. Beside the days: everything not jotted yet (a
 *  status list), and for a branch its meat. */
export function DailyLog({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const [filter, setFilter] = useState<Filter>("all");
  const [days, setDays] = useState(7);
  const own = account.role === "branch";
  // The branches whose daily sale this account watches: the Account Manager sees no sale.
  const saleBranches = own
    ? [account.branch ?? ""]
    : account.hidesSales
      ? []
      : branches;
  const notes = useMemo(() => visibleNotes(db, account), [db, account]);
  const shown = notes.filter((e) => {
    if (filter === "all") return true;
    if (filter === "missing") return noteTags(db, e, account).length > 0;
    const group = isNoteKind(e.kind) ? kindInfo[e.kind].group : "";
    // The notes jotted on a Lot beyond its four core ones are Lot notes too.
    return group === filter || (filter === "lot" && group === "extra");
  });
  const cards = Array.from({ length: days }, (_, back) => {
    const date = dayBack(today, back);
    const rows = shown.filter((e) => e.date === date);
    const unsold = saleBranches.filter((name) => !hasSale(db, name, date));
    // A day with nothing jotted is listed only for what is missing on it.
    if (!rows.length && (filter !== "all" || !unsold.length)) return null;
    return (
      <DayCard
        key={date}
        data-date={date}
        tone={unsold.length ? "warning" : "ok"}
        title={`${thaiDay(date, { weekday: "long", day: "numeric", month: "short" })}${back ? "" : " · วันนี้"}`}
        aside={
          saleBranches.length > 0 &&
          saleBranches.map((name) => {
            const lead = own ? "" : `${name} · `;
            return unsold.includes(name) ? (
              <Badge key={name} tone="warning">
                {lead}
                {missingText}ยอดขาย
              </Badge>
            ) : (
              <Badge key={name} tone="success">
                {lead}จดยอดขายแล้ว
              </Badge>
            );
          })
        }
      >
        {rows.map((e) => (
          <NoteRow key={e.id} entry={e} ws={ws} />
        ))}
      </DayCard>
    );
  });
  const meat = own ? branchMeat(db, account.branch ?? "", today) : null;

  return (
    // A wide screen: the change log is a third column, so a day's rows stay a readable length.
    <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[1000px]:grid-cols-1 max-md:gap-4 min-[1700px]:grid-cols-[minmax(0,1fr)_320px_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <SegmentedChoice
          label="กรองบันทึก"
          className="self-start"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "ทั้งหมด" },
            { value: "missing", label: missingText },
            ...(own
              ? []
              : ([
                  { value: "lot", label: "Lot" },
                  { value: "money", label: "เงิน" },
                  { value: "branch", label: "สาขา" },
                ] as const)),
          ]}
        />
        {cards.some(Boolean) ? (
          cards
        ) : (
          <EmptyState text="ไม่มีบันทึกในช่วงนี้" />
        )}
        <Button
          size="sm"
          className="self-center max-md:min-h-11"
          onClick={() => setDays(days + 7)}
        >
          ดูย้อนหลังอีก 7 วัน
        </Button>
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <TodoBox ws={ws} statusOnly />
        {meat && (
          <Panel compact aria-label="เนื้อคงเหลือ">
            <h2 className="m-0 text-h3">เนื้อคงเหลือ</h2>
            <ReadRow
              label="ตอนนี้"
              value={
                <span className={cn(meat.kg < 0 && "text-danger")}>
                  {qty(meat.kg)} กก.
                </span>
              }
            />
            <ReadRow
              label="นับล่าสุด"
              value={
                meat.counted
                  ? `${thaiDay(meat.counted.date)} ${timeOf(meat.counted.at)}`
                  : "—"
              }
            />
          </Panel>
        )}
      </aside>
      <div className="col-span-full min-w-0 min-[1700px]:col-auto">
        <ChangeLog ws={ws} />
      </div>
    </div>
  );
}
