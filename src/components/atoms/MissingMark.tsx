import type { ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { missingText } from "@/lib/store";

/** The yellow mark of a value that is not there: a field a note was saved without
 *  (ยังไม่ได้จด, the default), or a figure the web cannot work out yet. */
export function MissingMark({
  children = missingText,
}: {
  children?: ReactNode;
}) {
  return (
    <Badge tone="warning" className="border border-warning/40 py-0 font-medium">
      {children}
    </Badge>
  );
}
