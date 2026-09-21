import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  demoDb,
  dispatchDb,
  multiPoDb,
  open,
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

export const Completed: Story = {
  parameters: { db: demoDb },
  render: () => <FoodivaView db={demoDb} open={open} />,
};
