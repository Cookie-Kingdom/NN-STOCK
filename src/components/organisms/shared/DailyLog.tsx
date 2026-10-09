"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Panel } from "@/components/atoms/Panel";
import { ReadRow } from "@/components/atoms/ReadRow";
import { DayCard } from "@/components/molecules/DayCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { NoteRow } from "@/components/organisms/shared/NoteRow";
import { noteTags } from "@/components/organisms/shared/noteText";
import {
  ChangeLog,
  changesOf,
} from "@/components/organisms/workspace/ChangeLog";
import { TodoBox } from "@/components/organisms/workspace/TodoBox";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, qty, thaiDay } from "@/lib/format";
import {
  branchItem,
  branches,
  hasSale,
  isNoteKind,
  kindInfo,
  missingText,
  saleMoney,
  visibleNotes,
  type Entry,
} from "@/lib/store";
import { cn } from "@/lib/utils";

type Filter = "all" | "missing" | "lot" | "money" | "branch";

const dayBack = (today: string, back: number) =>
  new Date(Date.parse(today) - back * 86400000).toISOString().slice(0, 10);

/** Rows of a day drawn before 「ดูเพิ่มเติม」. */
const dayRows = 7;

/** One day: its head, and under it its notes once opened, `dayRows` at first. Closed, the head
 *  says how many notes the day has and the money in and out of them, in place of the rows. */
function Day({
  rows,
  ws,
  startOpen,
  title,
  aside,
  ...card
}: {
  rows: Entry[];
  ws: Workspace;
  startOpen: boolean;
  title: string;
  aside: ReactNode;
  tone: "ok" | "warning";
  "data-date": string;
}) {
  const [open, setOpen] = useState(startOpen);
  const { limit, more } = useShowMore("", dayRows);
  const { config } = ws.db;
  // The same money a row shows at its right (`noteAmount`): a sale in, a payment out.
  const moneyIn = rows.reduce(
    (sum, e) =>
      sum +
      (e.kind === "sale"
        ? saleMoney(config, e).sales
        : e.kind === "income" && e.values.status !== "cancelled"
          ? Number(e.values.amount) || 0
          : 0),
    0,
  );
  const moneyOut = rows
    .filter((e) => ["pay", "reimburse", "expense"].includes(e.kind))
    .reduce((sum, e) => sum + (Number(e.values.amount) || 0), 0);
  return (
    <DayCard
      {...card}
      title={
        rows.length ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex cursor-pointer items-center gap-1.5 text-left"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "size-4 shrink-0 transition-transform duration-(--motion-fast) ease-(--ease-standard)",
                open && "rotate-90",
              )}
            />
            {title}
          </button>
        ) : (
          title
        )
      }
      aside={
        <>
          {!open && rows.length > 0 && (
            <span className="mr-1.5 flex flex-wrap items-center gap-x-3 text-body-sm font-semibold">
              <span className="font-normal text-text-secondary">
                {rows.length} บันทึก
              </span>
              {moneyIn > 0 && (
                <span className="text-success">+{baht(moneyIn)}</span>
              )}
              {moneyOut > 0 && (
                <span className="text-danger">−{baht(moneyOut)}</span>
              )}
            </span>
          )}
          {aside}
        </>
      }
    >
      {open && (
        <>
          {rows.slice(0, limit).map((e) => (
            <NoteRow key={e.id} entry={e} ws={ws} />
          ))}
          <ShowMore
            shown={Math.min(limit, rows.length)}
            total={rows.length}
            onMore={more}
          />
        </>
      )}
    </DayCard>
  );
}

/** Every note the account sees, one card per day, newest day first: the last 7 days, and 7
 *  more with each press of 「ดูย้อนหลังอีก 7 วัน」. Today is open; an earlier day is closed
 *  until its head is pressed, unless a filter is on (then every day with a match is open). A
 *  page for looking: nothing here opens a
 *  new note, only a row its edit or delete. A day's head says per branch whether its sale is
 *  jotted; a day with one missing is yellow. Beside the days: everything not jotted yet (a
 *  status list), and for a branch its meat as its daily sheet reads (`branchItem`). */
export function DailyLog({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const [filter, setFilter] = useState<Filter>("all");
  const [days, setDays] = useState(7);
  const [log, setLog] = useState(false);
  const own = account.role === "branch";
  // The branches whose daily sale this account watches.
  const saleBranches = own ? [account.branch ?? ""] : branches;
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
      <Day
        // A filter starts the days over: open or closed as the new filter says.
        key={`${date}|${filter}`}
        rows={rows}
        ws={ws}
        startOpen={!back || filter !== "all"}
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
      />
    );
  });
  const meat = own ? branchItem(db, account.branch ?? "", "meat", today) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[1000px]:grid-cols-1 max-md:gap-4">
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
        {/* The foot of the list: more days at the left, the log of changes at the right. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Button
            size="sm"
            icon={<ChevronDown />}
            className="max-md:min-h-11"
            onClick={() => setDays(days + 7)}
          >
            ดูย้อนหลังอีก 7 วัน
          </Button>
          <Button
            variant="link"
            aria-expanded={log}
            icon={<History />}
            className="text-body-sm max-md:min-h-11"
            onClick={() => setLog(!log)}
          >
            ประวัติการแก้ไขและลบ ({changesOf(db, account).length})
          </Button>
        </div>
        {log && <ChangeLog ws={ws} />}
      </div>
      <aside className="flex min-w-0 flex-col gap-4">
        <TodoBox ws={ws} statusOnly />
        {meat && (
          <Panel compact aria-label="เนื้อคงเหลือ">
            <h2 className="m-0 text-h3">เนื้อคงเหลือ</h2>
            <ReadRow
              label="ตอนนี้"
              value={
                <span className={cn(meat.remaining < 0 && "text-danger")}>
                  {qty(meat.remaining)} กก.
                </span>
              }
            />
            <ReadRow
              label="ใบสต๊อกวันนี้"
              value={meat.saved ? "บันทึกแล้ว" : "ยังไม่บันทึกวันนี้"}
            />
          </Panel>
        )}
      </aside>
    </div>
  );
}
