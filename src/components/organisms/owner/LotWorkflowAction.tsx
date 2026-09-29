"use client";

import { Button } from "@/components/atoms/Button";
import { LotProgressChips } from "@/components/molecules/LotProgressChips";
import { fmt } from "@/lib/format";
import {
  lotProgress,
  produced,
  titles,
  type Database,
  type Lot,
  type EntryKind,
} from "@/lib/store";

/** One batch on the manifest: the steps it still has no entry for, and the Owner's own
 *  buttons for it. Nothing waits on anything (PRIN-02): the smoke PO can be issued before
 *  Foodiva's Packing List, the truck home booked before Chef House closes the lot. */
export function LotWorkflowAction({
  db,
  lot,
  open,
}: {
  db: Database;
  lot: Lot;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const done = lotProgress(db, lot.id);
  // One right-aligned box: a bare `flex` ignores the cell's `text-right`.
  return (
    <span className="inline-grid justify-items-end gap-2">
      <LotProgressChips db={db} lotId={lot.id} />
      <span className="inline-flex flex-wrap justify-end gap-2">
        {!done.has("smokeOrder") && (
          <Button variant="table" onClick={() => open("smokeOrder", lot.id)}>
            {titles.smokeOrder}
          </Button>
        )}
        {!done.has("return") && (
          <Button variant="table" onClick={() => open("return", lot.id)}>
            {titles.return}
            {done.has("smoke") && ` · ${fmt(produced(db, lot.id))} กก.`}
          </Button>
        )}
      </span>
    </span>
  );
}
