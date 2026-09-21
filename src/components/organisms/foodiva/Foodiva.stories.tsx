import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  demoDb,
  dispatchDb,
  multiPoDb,
  open,
  ownerReservedDb,
  returnGapDb,
  returnTruckDb,
} from "../../../../.storybook/fixtures";
import { FoodivaView } from "./FoodivaView";

const meta: Meta = { title: "Organisms/Foodiva" };

export default meta;
type Story = StoryObj;

export const WaitingForDispatch: Story = {
  parameters: { db: dispatchDb },
  render: () => <FoodivaView db={dispatchDb} open={open} />,
};

/** "Request เข้า" is empty (the only Request is trucked); every PO shows its kg left to send. */
export const PurchasePosRemaining: Story = {
  parameters: { db: multiPoDb },
  render: () => <FoodivaView db={multiPoDb} open={open} />,
};

/** 10 kg kept for the Owner, 4 kg already picked up: "เก็บไว้ให้ Owner คงเหลือ" shows 6 kg. */
export const KeptForOwner: Story = {
  parameters: { db: ownerReservedDb },
  render: () => <FoodivaView db={ownerReservedDb} open={open} />,
};

/** Return truck on its way: "ยืนยันรับเข้าตู้" next to what Chef House sent (กล่องรมควัน / kg). */
export const ReturnLegWaiting: Story = {
  parameters: { db: returnTruckDb },
  render: () => <FoodivaView db={returnTruckDb} open={open} />,
};

/** Weighed in 0.5 kg short of what Chef House sent: the gap is flagged until the Owner's central count. */
export const ReturnLegReceived: Story = {
  parameters: { db: returnGapDb },
  render: () => <FoodivaView db={returnGapDb} open={open} />,
};

export const Completed: Story = {
  parameters: { db: demoDb },
  render: () => <FoodivaView db={demoDb} open={open} />,
};
