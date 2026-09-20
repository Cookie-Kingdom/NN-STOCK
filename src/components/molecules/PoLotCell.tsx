import type { ReactNode } from "react";
import { Caption } from "@/components/atoms/Text";
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
      {sub && <Caption className="block">{sub}</Caption>}
    </span>
  );
}
