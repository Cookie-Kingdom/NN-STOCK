import type { ReactNode } from "react";
import { ReadRow } from "@/components/atoms/ReadRow";

/** Summary of the earlier document a form builds on, shown under the fields. */
export function ReferenceCard({
  title,
  number,
  rows,
  action,
}: {
  title: string;
  number: string;
  rows: [string, string][];
  /** e.g. a document preview button. */
  action?: ReactNode;
}) {
  return (
    <section
      aria-label={`เอกสารอ้างอิง ${title}`}
      className="my-4.5 rounded-lg border border-border bg-bg p-4.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3>
          อ้างอิง {title} · {number}
        </h3>
        {action}
      </div>
      {rows.map(([label, value]) => (
        <ReadRow key={label} label={label} value={value || "—"} />
      ))}
    </section>
  );
}
