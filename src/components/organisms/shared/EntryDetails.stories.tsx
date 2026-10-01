import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { Entry } from "@/lib/store";
import { incompletePoDb, smokedDb } from "../../../../.storybook/fixtures";
import { EntryDetails } from "./EntryDetails";

/** Foodiva's invoice saved with the date and the file left empty (GEN-02). */
const incomplete: Entry = {
  id: "story-missing",
  kind: "foodivaConfirm",
  role: "foodiva",
  lotId: "",
  branch: "ศาลาแดง",
  date: "2026-09-28",
  at: "2026-09-28T09:00:00.000Z",
  values: {
    invoiceNo: "INV-0921",
    invoiceDate: "",
    attachment: "",
    confirmedBy: "สมชาย",
    confirmedKg: "120",
    readyForChiangMaiKg: "120",
    reservedForOwnerKg: "0",
    invoiceAmount: "",
    missing: "invoiceDate,attachment,invoiceAmount",
  },
};

const meta = {
  title: "Organisms/Shared/EntryDetails",
  component: EntryDetails,
  args: { entry: incomplete, role: "owner", open: true, onChanged: fn() },
} satisfies Meta<typeof EntryDetails>;

export default meta;

/** The summary says how many fields were left empty; each one reads "ยังไม่ได้กรอก". */
export const MissingFields: StoryObj<typeof meta> = {};

/** EDT-01: a purchase PO is edited from the Log like any other entry. "แก้ไข" opens its own
 *  form, so the seller and phone left empty at save can be filled in later. */
export const PurchaseOrder: StoryObj<typeof meta> = {
  args: { entry: incompletePoDb.entries[0], db: incompletePoDb },
  parameters: { db: incompletePoDb },
};

/** A batch step (the transport document): its edit lists the truck and the kg sent. A place
 *  typed by hand comes back under "อื่น ๆ". */
export const TransportDocument: StoryObj<typeof meta> = {
  args: {
    entry: smokedDb.entries.find((entry) => entry.kind === "dispatch")!,
    db: smokedDb,
  },
  parameters: { db: smokedDb },
};
