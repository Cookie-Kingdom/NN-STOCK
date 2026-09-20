import type { ReactNode } from "react";
import { ReadRow } from "@/components/atoms/ReadRow";
import { cn } from "@/lib/utils";

/**
 * Summary of the earlier document a form builds on, shown under the fields.
 * With a `number` the heading reads "อ้างอิง {title} · {number}"; without one the
 * card is a plain titled read-only block, which is how the pre-save preview of a
 * form's own values uses it.
 */
export function ReferenceCard({
  title,
  number,
  rows,
  action,
  className,
}: {
  title: string;
  number?: string;
  rows: [string, string][];
  /** e.g. a document preview button. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={number ? `เอกสารอ้างอิง ${title}` : title}
      className={cn(
        "my-4.5 rounded-lg border border-border bg-bg p-4.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3>
          {number ? (
            <>
              อ้างอิง {title} · {number}
            </>
          ) : (
            title
          )}
        </h3>
        {action}
      </div>
      {rows.map(([label, value]) => (
        <ReadRow key={label} label={label} value={value || "—"} />
      ))}
    </section>
  );
}
