import { Check } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import type { EntryKind } from "@/lib/store";

/** The steps Foodiva follows on a shipment batch, in the order they usually happen. */
const steps: [EntryKind, string][] = [
  ["smokeOrder", "PO รมควัน"],
  ["dispatch", "ใบขนส่ง"],
  ["packingList", "Packing List"],
  ["cmReceive", "Chef House รับ"],
  ["smoke", "สโมค"],
  ["return", "รถขากลับ"],
  ["foodivaReturnReceive", "รับเข้าตู้"],
  ["central", "สต๊อกกลาง"],
];

/** What a batch already holds, read from `lotProgress` (SHP-04). A hint, never a gate: a
 *  missing step greys out, it does not close any button. */
export function BatchProgressChips({ progress }: { progress: Set<EntryKind> }) {
  return (
    <span className="flex max-w-md flex-wrap gap-1">
      {steps.map(([kind, label]) =>
        progress.has(kind) ? (
          <Badge key={kind} tone="success">
            <Check className="me-1 size-3" aria-hidden />
            {label}
          </Badge>
        ) : (
          <Badge key={kind} tone="neutral" className="opacity-70">
            <span className="sr-only">ยังไม่มี </span>
            {label}
          </Badge>
        ),
      )}
    </span>
  );
}
