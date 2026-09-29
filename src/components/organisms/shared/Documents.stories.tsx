import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { day, demoDb } from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { DocumentFilterBar } from "./DocumentFilterBar";
import { DocumentPrintButton } from "@/components/molecules/DocumentPrintButton";
import type { DocumentReferenceType } from "./documentRows";
import { PackWeightFields } from "@/components/molecules/PackWeightFields";
import { Preview } from "./Preview";
import { PurchaseOrderDocumentPreview } from "./PurchaseOrderDocumentPreview";

const db = demoDb;
const lot = db.lots[0];
const smokeOrder = db.entries.find((entry) => entry.kind === "smokeOrder")!;

const meta: Meta = {
  title: "Organisms/Documents",
  parameters: { db },
};

export default meta;
type Story = StoryObj;

function FilterDemo() {
  const [referenceType, setReferenceType] =
    useState<DocumentReferenceType>("po");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(day);
  return (
    <DocumentFilterBar
      referenceType={referenceType}
      query={query}
      fromDate={fromDate}
      toDate={toDate}
      onReferenceType={setReferenceType}
      onQuery={setQuery}
      onFromDate={setFromDate}
      onToDate={setToDate}
    />
  );
}

export const FilterBar: Story = { render: () => <FilterDemo /> };

export const PrintButtons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <DocumentPrintButton
        title="Purchase Order"
        number={lot.poId}
        rows={[
          ["ผู้ขาย", lot.values.supplier],
          ["น้ำหนักสั่ง", `${lot.values.orderedKg} กก.`],
        ]}
      />
      <DocumentPrintButton
        title="Purchase Order"
        number={lot.poId}
        rows={[["ผู้ขาย", lot.values.supplier]]}
        label="ดู PO / PDF"
        preview
      />
    </div>
  ),
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

export const EntryPreview: Story = {
  render: () => (
    <Preview
      db={db}
      branch="ศาลาแดง"
      lot={lot}
      kind="sale"
      v={{ soldKg: "2.5", amount: "3500" }}
    />
  ),
};

function PackWeightsDemo() {
  const [value, setValue] = useState("0.100\n0.105\n0.098");
  return (
    <PackWeightFields
      value={value}
      onChange={(next) => {
        setValue(next);
        fn()(next);
      }}
    />
  );
}

export const PackWeights: Story = { render: () => <PackWeightsDemo /> };
