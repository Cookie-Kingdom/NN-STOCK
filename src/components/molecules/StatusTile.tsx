import type { ReactNode } from "react";
import { missingText } from "@/lib/store";
import { cn } from "@/lib/utils";

const tile =
  "flex min-h-11 min-w-0 flex-col rounded-md border px-3 py-2.5 text-left";

/** One thing that is either jotted or not. With a `value` it is green and shows it; without
 *  one it is yellow and says ยังไม่ได้จด, and with `onJot` the whole tile is the button that
 *  opens the form. The colour is also `data-tone`, for the tests. */
export function StatusTile({
  label,
  value,
  onJot,
  jotText = `${missingText} กดเพื่อจด`,
  className,
}: {
  label: ReactNode;
  /** What was jotted, e.g. "200 กก." Empty or absent: not jotted. */
  value?: ReactNode;
  onJot?: () => void;
  /** What the yellow button says. */
  jotText?: string;
  className?: string;
}) {
  const name = <strong className="text-body-sm font-semibold">{label}</strong>;
  if (value != null && value !== "")
    return (
      <div
        data-tone="ok"
        className={cn(
          tile,
          "border-success/30 bg-success-subtle text-success",
          className,
        )}
      >
        {name}
        <span className="text-caption">{value}</span>
      </div>
    );
  const yellow = cn(
    tile,
    "border-warning/40 bg-warning-subtle text-warning",
    className,
  );
  if (!onJot)
    return (
      <div data-tone="warning" className={yellow}>
        {name}
        <span className="text-caption">{missingText}</span>
      </div>
    );
  return (
    <button
      type="button"
      data-tone="warning"
      onClick={onJot}
      className={cn(
        yellow,
        "cursor-pointer transition-colors duration-(--motion-fast) ease-(--ease-standard) hover:border-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
      )}
    >
      {name}
      <span className="text-caption">{jotText}</span>
    </button>
  );
}
