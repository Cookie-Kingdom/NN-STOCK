import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { Entry } from "@/lib/store";
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
