import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Table cell: PO number (bold, "-" when missing), Lot id underneath, optional muted line. */
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
      {sub && <small className="block text-caption text-text-secondary">{sub}</small>}
    </span>
  );
}
