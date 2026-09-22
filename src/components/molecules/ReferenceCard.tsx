import type { ReactNode } from "react";
import { ReadRow } from "@/components/atoms/ReadRow";
import { cn } from "@/lib/utils";

/**
 * Summary of the earlier document a form builds on — the PO behind a receipt, say —
 * shown under the fields as read-only `ReadRow`s. `rows` is a list of `[label, value]`
 * pairs and an empty value falls back to "—"; `action` takes something like a document
 * preview button, shown next to the title. Without a `number` the heading is the plain
 * `title`, which is how a form previews its own values before saving.
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
  rows: [string, ReactNode][];
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
