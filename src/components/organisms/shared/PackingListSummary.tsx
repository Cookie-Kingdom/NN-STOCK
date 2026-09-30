import { MissingMark } from "@/components/atoms/MissingMark";
import { ReadRow } from "@/components/atoms/ReadRow";
import { AttachmentButton } from "@/components/molecules/AttachmentButton";
import { fmt } from "@/lib/format";
import { n, type Values } from "@/lib/store";

/** kg of a saved figure, or "ยังไม่ได้กรอก" when Foodiva left it blank. */
function kg(values: Values, key: string) {
  return values[key]?.trim() ? `${fmt(n(values, key))} กก.` : <MissingMark />;
}

/**
 * Foodiva's Packing List as it was saved: the file it attached (the per-box evidence
 * Chef House checks against) and the typed totals. No per-box rows: there are too many
 * boxes to type, so the file carries them. `receivedKg`, once Chef House has weighed in,
 * sits under Foodiva's total so the two can be compared.
 */
export function PackingListSummary({
  values,
  receivedKg,
}: {
  values: Values;
  receivedKg?: string;
}) {
  return (
    <section
      aria-label="Packing List ของ Foodiva"
      className="grid gap-3 rounded-lg border border-border bg-bg px-4 py-3"
    >
      {values.attachmentStorageKey ? (
        <AttachmentButton
          action="view"
          name={values.attachment}
          storageKey={values.attachmentStorageKey}
          label={`เปิดไฟล์ Packing List · ${values.attachment}`}
        />
      ) : (
        <ReadRow
          label="ไฟล์ Packing List"
          value={values.attachment?.trim() || <MissingMark />}
        />
      )}
      <div>
        <ReadRow
          label="เลข Invoice"
          value={values.invoiceNo?.trim() || <MissingMark />}
        />
        <ReadRow
          label="รายการสินค้า"
          value={values.product?.trim() || <MissingMark />}
        />
        {values.code?.trim() && (
          <ReadRow label="CODE สินค้า" value={values.code} />
        )}
        <ReadRow
          label="จำนวนกล่องรับเข้า"
          value={values.boxCount?.trim() ? `${values.boxCount} กล่อง` : "—"}
        />
        {values.invWeightKg?.trim() && (
          <ReadRow label="Inv. Weight" value={kg(values, "invWeightKg")} />
        )}
        <ReadRow
          label="น้ำหนักส่งรวม (Sliced Weight Net)"
          value={kg(values, "slicedNetKg")}
        />
        {values.invWeightKg?.trim() && (
          <ReadRow
            label="Sliced Weight Lost"
            value={kg(values, "slicedLostKg")}
          />
        )}
        {receivedKg !== undefined && (
          <ReadRow
            label="น้ำหนักรับรวม (Chef House)"
            value={
              receivedKg.trim() ? (
                `${fmt(Number(receivedKg))} กก.`
              ) : (
                <MissingMark />
              )
            }
          />
        )}
      </div>
    </section>
  );
}
