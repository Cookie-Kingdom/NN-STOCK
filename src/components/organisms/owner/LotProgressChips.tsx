"use client";

import { Badge } from "@/components/atoms/Badge";
import {
  batchSteps,
  missingSteps,
  stepLabels,
  type BatchStep,
} from "@/components/organisms/owner/lotSteps";
import type { Database } from "@/lib/store";

/** What a batch still has no entry for, one chip per step (RET-06, DASH-02). Advice only:
 *  nothing is closed because a chip is showing. `steps` narrows the list to what the
 *  screen is about; every step recorded reads as one "ครบ" chip. */
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
  if (!missing.length)
    return (
      <Badge tone="success">
        {steps === batchSteps ? "ครบทุกขั้น" : "ครบแล้ว"}
      </Badge>
    );
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1"
      aria-label={`ยังขาด ${missing.map((step) => stepLabels[step]).join(", ")}`}
    >
      <span className="text-caption text-text-secondary">ยังขาด</span>
      {missing.map((step) => (
        <Badge key={step} tone="neutral">
          {stepLabels[step]}
        </Badge>
      ))}
    </span>
  );
}
