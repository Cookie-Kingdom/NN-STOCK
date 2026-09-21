import { packingListBoxes, receivedBoxWeights, type Entry } from "@/lib/store";
import type {
  PackingListBox,
  PackingListHeader,
} from "@/components/organisms/shared/PackingListTable";

/** Yellow-cell draft: one slot per กล่องรับเข้า of the Packing List, blank until weighed. */
export type ReceivedDraft = (number | undefined)[];

/** The saved `receivedBoxes` value (or none) as a draft as long as the Packing List. */
export function receivedDraft(list: Entry | undefined, value?: string) {
  const saved = value ? receivedBoxWeights(value) : [];
  return packingListBoxes(list?.values.boxes).map((_, index) =>
    Number.isFinite(saved[index]) ? saved[index] : undefined,
  );
}

/** Back to the one-line-per-box value `cmReceive` / `chefEdit` take. A blank stays a
 *  blank line, so mutate names it instead of shifting the boxes under it. */
export const receivedValue = (draft: ReceivedDraft) =>
  draft.map((kg) => (kg === undefined ? "" : String(kg))).join("\n");

/** What PackingListTable needs to show Foodiva's saved list beside the yellow cells. */
export function packingListView(
  list: Entry,
  draft: ReceivedDraft,
): { header: PackingListHeader; boxes: PackingListBox[] } {
  const v = list.values;
  const num = (value?: string) =>
    value?.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
  return {
    header: {
      date: list.date,
      invoiceNo: v.invoiceNo ?? "",
      product: v.product ?? "",
      code: v.code,
      invWeight: num(v.invWeightKg),
      slicedNet: num(v.slicedNetKg),
      slicedLost: num(v.slicedLostKg),
    },
    boxes: packingListBoxes(v.boxes).map((weight, index) => ({
      no: index + 1,
      weight,
      received: draft[index],
    })),
  };
}
