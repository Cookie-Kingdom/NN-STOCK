"use client";

import { useMemo } from "react";
import { Panel } from "@/components/atoms/Panel";
import { ReadRow } from "@/components/atoms/ReadRow";
import { DayCard } from "@/components/molecules/DayCard";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { NoteRow } from "@/components/organisms/shared/NoteRow";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, qty, thaiDay } from "@/lib/format";
import { giftBoxes, plBetween, visibleNotes } from "@/lib/store";

/** Days drawn before 「ดูเพิ่มเติม」. */
const dayStep = 7;

/** A branch's Sales: today's figures, then the `sale` and `influencerBox` notes it has jotted,
 *  a card per day, newest day first. A row opens as it does in Daily Log, with its edit and
 *  delete. The two notes are jotted from the page's header (`kindsForPage`). */
export function BranchSales({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const notes = useMemo(
    () =>
      visibleNotes(db, account).filter(
        (e) => e.kind === "sale" || e.kind === "influencerBox",
      ),
    [db, account],
  );
  // Newest first already (`visibleNotes`).
  const dates = [...new Set(notes.map((e) => e.date))];
  const { limit, more } = useShowMore("", dayStep);
  // A branch holds its own notes only, so the day's P&L is its own sale.
  const sold = plBetween(db, today, today);
  return (
    <div className="flex flex-col gap-4">
      <Panel compact aria-label="ยอดวันนี้">
        <h2 className="m-0 text-h3">วันนี้</h2>
        <ReadRow label="กล่องที่ขาย" value={qty(sold.boxes)} />
        <ReadRow label="ยอดขาย" value={baht(sold.sales)} />
        {/* The helper takes a date prefix: a whole date is that one day. */}
        <ReadRow label="กล่องแจก" value={qty(giftBoxes(db, today).boxes)} />
      </Panel>
      {dates.length === 0 && <EmptyState text="ยังไม่มียอดขายหรือกล่องแจก" />}
      {dates.slice(0, limit).map((date) => (
        <DayCard
          key={date}
          data-date={date}
          title={`${thaiDay(date, { weekday: "long", day: "numeric", month: "short" })}${date === today ? " · วันนี้" : ""}`}
        >
          {notes
            .filter((e) => e.date === date)
            .map((e) => (
              <NoteRow key={e.id} entry={e} ws={ws} />
            ))}
        </DayCard>
      ))}
      <ShowMore
        shown={Math.min(limit, dates.length)}
        total={dates.length}
        onMore={more}
      />
    </div>
  );
}
