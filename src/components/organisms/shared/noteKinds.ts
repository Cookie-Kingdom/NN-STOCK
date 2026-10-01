import { forms } from "@/lib/forms";
import type { Tab } from "@/lib/nav";
import { saleMoneyKeys, type ActingRole, type EntryKind } from "@/lib/store";
import { retiredKinds } from "@/lib/store/model";

type NoteGroup = { label: string; kinds: EntryKind[] };

/* ponytail: who records which kind is `ownership` in store/mutate.ts, which is not exported,
 * and nothing says what a note is about, so this list is both. Corrections, bookkeeping and
 * the settings (chefEdit, void, the edit kinds, link, config) are not notes: they stay on
 * their own screens. tests/unit/noteKinds.test.ts holds it against mutate; drop the role
 * half once `ownership` is exported. */
const groups: Record<ActingRole, NoteGroup[]> = {
  owner: [
    {
      label: "ซื้อ",
      kinds: [
        "purchase",
        "foodivaConfirm",
        "materialReceive",
        "generalPurchase",
      ],
    },
    {
      label: "ผลิต",
      kinds: [
        "smokeOrder",
        "smokeOrderAccept",
        "cmReceive",
        "prepare",
        "smoke",
        "closeLot",
      ],
    },
    {
      label: "ขนส่ง / รับเข้า",
      kinds: [
        "dispatch",
        "packingList",
        "return",
        "foodivaReturnReceive",
        "central",
        "ownerWasteReceive",
      ],
    },
    {
      label: "เงิน",
      kinds: [
        "meatPayment",
        "smokingInvoice",
        "invoiceReview",
        "invoicePayment",
        "expense",
      ],
    },
    { label: "ประจำวัน", kinds: ["unlock"] },
  ],
  branch: [
    { label: "ซื้อ", kinds: ["ricePurchase"] },
    { label: "รับเข้า", kinds: ["receive", "materialConfirm", "chiliReceive"] },
    {
      label: "สต๊อก / วัตถุดิบ",
      kinds: ["thaw", "riceIssue", "rice", "riceCarry", "materials"],
    },
    { label: "ขาย / ประจำวัน", kinds: ["sale", "influencerBox", "closeDay"] },
  ],
};

/** What 「จดบันทึก」 offers `role`, grouped by what the note is about. The groups are
 *  topics, not a sequence: any of them can be recorded at any time. */
export function noteGroups(role: ActingRole, hidesSales = false): NoteGroup[] {
  return groups[role]
    .map((group) => ({
      ...group,
      kinds: group.kinds.filter(
        (kind) =>
          !retiredKinds.includes(kind) &&
          // The Account Manager's copy has no sale money: no form that asks for it.
          !(
            hidesSales &&
            forms[kind]?.some((field) => saleMoneyKeys.includes(field.key))
          ),
      ),
    }))
    .filter((group) => group.kinds.length);
}

/** Kinds recorded on a screen of their own, not in a dialog: 「จดบันทึก」 goes there. */
export const noteTabs: Partial<Record<EntryKind, Tab>> = {
  materials: "material-count",
  materialConfirm: "material-receive",
};

/** Kinds recorded on a purchase PO: mutate refuses any other lot, and none (GEN-10). */
export const poLotKinds: EntryKind[] = [
  "foodivaConfirm",
  "ownerWasteReceive",
  "meatPayment",
];
/** Kinds mutate refuses without a lot: a purchase PO's own, and the two that answer a
 *  document already on a batch (its smoke PO, its smoking invoice). Every other kind is
 *  saved without one. */
export const lotRequiredKinds: EntryKind[] = [
  ...poLotKinds,
  "smokeOrderAccept",
  "invoiceReview",
];
