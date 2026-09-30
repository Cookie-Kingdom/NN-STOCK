"use client";

import { Button } from "@/components/atoms/Button";
import { LotProgressChips } from "@/components/molecules/LotProgressChips";
import { again } from "@/components/organisms/owner/lotSteps";
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
        {/* GEN-06: a step already saved keeps its button; saving again is said and the
         *  newest counts. Central stock is re-recorded here once the batch left that tab. */}
        <Button
          variant={done.has("smokeOrder") ? "table-secondary" : "table"}
          onClick={() => open("smokeOrder", lot.id)}
        >
          {again(titles.smokeOrder, done.has("smokeOrder"))}
        </Button>
        <Button
          variant={done.has("return") ? "table-secondary" : "table"}
          onClick={() => open("return", lot.id)}
        >
          {again(titles.return, done.has("return"))}
          {!done.has("return") &&
            done.has("smoke") &&
            ` · ${fmt(produced(db, lot.id))} กก.`}
        </Button>
        {done.has("central") && (
          <Button
            variant="table-secondary"
            onClick={() => open("central", lot.id)}
          >
            {again(titles.central, true)}
          </Button>
        )}
      </span>
    </span>
  );
}
