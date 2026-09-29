import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import type { EntryKind, Values } from "@/lib/store";
import { day, demoDb } from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { DocumentFilterBar } from "./DocumentFilterBar";
import type { DocumentReferenceType } from "./documentRows";
import { Preview } from "./Preview";
import { PurchaseOrderDocumentPreview } from "./PurchaseOrderDocumentPreview";

const db = demoDb;
const lot = db.lots[0];
const smokeOrder = db.entries.find((entry) => entry.kind === "smokeOrder")!;

const meta: Meta = {
  title: "Organisms/Shared/Documents",
  parameters: { db },
};

export default meta;

type FilterArgs = {
  referenceType: DocumentReferenceType;
  query: string;
  fromDate: string;
  toDate: string;
};

/** Controlled from Controls and from the bar itself: typing in the bar writes the arg. */
export const FilterBar: StoryObj<FilterArgs> = {
  args: { referenceType: "po", query: "", fromDate: "", toDate: day },
  argTypes: {
    referenceType: {
      name: "กรองตาม",
      control: { type: "radio", labels: { po: "เลข PO", lot: "เลข Lot" } },
      options: ["po", "lot"],
    },
    query: { control: "text" },
    fromDate: { control: "text" },
    toDate: { control: "text" },
  },
  render: function Render(args) {
    const [, update] = useArgs<FilterArgs>();
    const set =
      <K extends keyof FilterArgs>(key: K) =>
      (value: FilterArgs[K]) => {
        fn().mockName(key)(value);
        update({ [key]: value });
      };
    return (
      <DocumentFilterBar
        {...args}
        onReferenceType={set("referenceType")}
        onQuery={set("query")}
        onFromDate={set("fromDate")}
        onToDate={set("toDate")}
      />
    );
  },
};

const order = pick("ใบสั่ง", {
  "PO ซื้อเนื้อ": {
    kind: "purchase" as const,
    values: lot.values,
    date: day,
  },
  "PO รมควัน": {
    kind: "smokeOrder" as const,
    values: smokeOrder.values,
    date: smokeOrder.date,
  },
});

/** เลือกใบสั่งใน Controls: PO ซื้อเนื้อ หรือ PO รมควัน ของ Lot เดียวกัน */
export const PurchaseOrderPreview: StoryObj<{ order: typeof order.initial }> = {
  argTypes: { order: order.argType },
  args: { order: order.initial },
  render: ({ order }) => (
    <PurchaseOrderDocumentPreview db={db} lot={lot} {...order} />
  ),
};

/** Every kind Preview draws, each from the demo run's first entry of that kind. */
const previewKinds: EntryKind[] = [
  "purchase",
  "foodivaConfirm",
  "dispatch",
  "smokeOrder",
  "smokingInvoice",
  "cmReceive",
  "prepare",
  "smoke",
  "closeLot",
  "return",
  "central",
  "sale",
  "influencerBox",
  "riceCarry",
  "riceIssue",
  "chiliIssue",
];
const entry = pick(
  "รายการ",
  Object.fromEntries(
    previewKinds.flatMap((kind) => {
      const e = db.entries.find((x) => x.kind === kind);
      return e ? [[kind, e]] : [];
    }),
  ),
);
const giveaways = pick("อินฟลูเอนเซอร์ (sale)", {
  ไม่มี: [] as Values[],
  "1 ราย": [{ boxes: "2", chiliAddons: "1", shippingFee: "80" }],
});

/** The summary under an entry form. เลือกใน Controls:
 *  - รายการ: ชนิดรายการ ใช้ค่าจริงจากรอบตัวอย่าง
 *  - อินฟลูเอนเซอร์: บล็อกของแจกที่บันทึกพร้อมยอดขาย (มีผลกับ sale) */
export const EntryPreview: StoryObj<{
  entry: (typeof db.entries)[number];
  giveaways: Values[];
}> = {
  argTypes: { entry: entry.argType, giveaways: giveaways.argType },
  args: { entry: entry.initial, giveaways: giveaways.initial },
  render: ({ entry, giveaways }) => (
    <Preview
      db={db}
      branch={entry.branch ?? "ศาลาแดง"}
      lot={db.lots.find((l) => l.id === entry.lotId) ?? lot}
      kind={entry.kind}
      v={entry.values}
      giveaways={giveaways}
    />
  ),
};
