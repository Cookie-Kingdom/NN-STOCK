import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { shipments, type Database } from "@/lib/store";
import {
  demoDb,
  dispatchedDb,
  returnGapDb,
} from "../../../../.storybook/fixtures";
import { ShipmentChainCard } from "./ShipmentChainCard";

const card = (db: Database) => (
  <ShipmentChainCard db={db} lot={shipments(db).at(-1)!} />
);

const meta: Meta = {
  title: "Organisms/Owner/ShipmentChainCard",
  parameters: { db: returnGapDb },
};

export default meta;
type Story = StoryObj;

/** Back in Foodiva's freezer: every step filled; Chef House weighed in 1 kg under, Foodiva 0.5 kg under. */
export const Returned: Story = { render: () => card(returnGapDb) };

/** On the truck to Chef House: later steps read "รอดำเนินการ". */
export const InTransit: Story = {
  parameters: { db: dispatchedDb },
  render: () => card(dispatchedDb),
};

/** The seven-day demo run, allocated and sold. */
export const Demo: Story = {
  parameters: { db: demoDb },
  render: () => card(demoDb),
};
