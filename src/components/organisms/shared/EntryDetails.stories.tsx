import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, fn, within } from "storybook/test";
import { Panel } from "@/components/atoms/Panel";
import { entries, visibleEntries, type Entry } from "@/lib/store";
import {
  changesDb,
  incompletePoDb,
  requestedDb,
  smokedDb,
} from "../../../../.storybook/fixtures";
import { EditEntryForm, EntryDetails } from "./EntryDetails";

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

/** One row of the Log. The edit form is among the stories, so no Docs page. */
const meta = {
  title: "Organisms/Shared/EntryDetails",
  component: EntryDetails,
  tags: ["!autodocs"],
  args: { entry: incomplete, role: "owner", open: true, onChanged: fn() },
} satisfies Meta<typeof EntryDetails>;

export default meta;

/** The summary says how many fields were left empty; each one reads "ยังไม่ได้กรอก". */
export const MissingFields: StoryObj<typeof meta> = {};

/** EDT-01: a purchase PO is edited from the Log like any other entry. "แก้ไข" opens its own
 *  form, so the seller and phone left empty at save can be filled in later; "ลบรายการ"
 *  deletes it. */
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

/** What ศาลาแดง's account reads of `changesDb`. */
const branchDb = {
  ...changesDb,
  entries: visibleEntries(changesDb, "branch", "ศาลาแดง"),
};

/** EDT-22: ศาลาแดง edits its own sale on a closed day, directly. The row reads "แก้ไขแล้ว"
 *  with the trail of its first edit; "แก้ไข" (pressed here) opens the sale form with
 *  "วันที่ทำรายการ", and the save applies at once. "ลบรายการ" sits beside it. */
export const BranchEdit: StoryObj<typeof meta> = {
  args: {
    entry: branchDb.entries.find((entry) => entry.kind === "sale")!,
    db: branchDb,
    lookup: changesDb,
    role: "branch",
    branch: "ศาลาแดง",
  },
  play: async ({ canvasElement }) => {
    fireEvent.click(
      within(canvasElement).getByRole("button", { name: "แก้ไข" }),
    );
  },
};

const deleted = changesDb.entries.find((entry) => entry.kind === "riceCarry")!;

/** EDT-23: ศาลาแดง deleted its cooked-rice count. The entry reads "ลบแล้ว" and has no
 *  buttons; the delete above it, "ลบรายการ · ยืนยันข้าวเหนียวสุกคงเหลือ", carries
 *  "กู้คืนรายการ", which puts the entry back. */
export const Deleted: StoryObj<typeof meta> = {
  parameters: { db: changesDb },
  render: (args) => (
    <>
      <EntryDetails
        {...args}
        entry={changesDb.entries.find(
          (entry) =>
            entry.kind === "void" && entry.values.targetId === deleted.id,
        )!}
        db={changesDb}
      />
      <EntryDetails {...args} entry={deleted} db={changesDb} />
    </>
  ),
};

/** EDT-24, SMK-05: the Owner edits a smoke PO. "วันที่ทำรายการ" re-dates it and "ชุดรมควัน"
 *  moves it to the other batch; above the fields, the purchase-PO table of the new PO form,
 *  prefilled with the 400 kg it draws ("คงเหลือ" adds that 400 kg back). The reason is
 *  optional. */
export const EditForm: StoryObj = {
  parameters: { db: requestedDb },
  render: () => (
    <Panel>
      <EditEntryForm
        entry={entries(requestedDb, "smokeOrder")[0]}
        db={requestedDb}
        onCancel={fn()}
        onSubmit={fn()}
      />
    </Panel>
  ),
};
