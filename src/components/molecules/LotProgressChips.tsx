"use client";

import { Badge } from "@/components/atoms/Badge";
import {
  batchSteps,
  missingSteps,
  stepLabels,
  type BatchStep,
} from "@/components/organisms/owner/lotSteps";
import type { Database } from "@/lib/store";

/** What a batch has no entry for yet, one chip per record (RET-06, DASH-02). A hint, in no
 *  order: nothing is closed because a chip is showing. `steps` narrows the list to what
 *  the screen is about; all of them recorded reads as one "จดครบแล้ว" chip. */
export function LotProgressChips({
  db,
  lotId,
  steps = batchSteps,
}: {
  db: Database;
  lotId: string;
  steps?: readonly BatchStep[];
}) {
  const missing = missingSteps(db, lotId, steps);
  if (!missing.length) return <Badge tone="success">จดครบแล้ว</Badge>;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1"
      aria-label={`ยังไม่ได้จด ${missing.map((step) => stepLabels[step]).join(", ")}`}
    >
      <span className="text-caption text-text-secondary">ยังไม่ได้จด</span>
      {missing.map((step) => (
        <Badge key={step} tone="neutral">
          {stepLabels[step]}
        </Badge>
      ))}
    </span>
  );
}
