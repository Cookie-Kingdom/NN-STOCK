import type { ReactNode } from "react";
import { Caption } from "@/components/atoms/Text";
import { cn } from "@/lib/utils";

/**
 * Table cell pairing a purchase order with the lot it became: `poId` in bold on the
 * first line ("-" when there is none yet) and `lotId` underneath, plus an optional muted
 * `sub` line. It renders a `<span>`, so it goes inside the `<td>` rather than replacing it.
 */
export function PoLotCell({
  poId,
  lotId,
  sub,
  className,
}: {
  poId?: string | null;
  lotId: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(className)}>
      <strong>{poId || "-"}</strong>
      <br />
      {lotId}
      {sub && <Caption className="block">{sub}</Caption>}
    </span>
  );
}
