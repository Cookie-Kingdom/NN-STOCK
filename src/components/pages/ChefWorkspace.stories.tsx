import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { chefBusyDb, demoDb, smokedDb } from "../../../.storybook/fixtures";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import { ChefWorkspace } from "./ChefWorkspace";

// See OwnerWorkspace.stories.tsx for why each story sets the URL segment.
const at = (tab: Tab) => ({ nextjs: { navigation: { segments: [tab] } } });

const meta: Meta = {
  title: "Pages/Chef",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: smokedDb },
  render: () => <ChefWorkspace account={accountById("chef")!} />,
};

export default meta;
type Story = StoryObj;

export const Receive: Story = { parameters: at("cm-receive") };
export const Work: Story = { parameters: at("work") };

/** The bell with real work in it: open it in the header. One shipment is at the door with
 *  its smoke PO still unaccepted — its row offers both the PO button and the pointer to the
 *  receive tab — and a closed run has an invoice the Owner sent back. */
export const WorkWithAlerts: Story = {
  parameters: { ...at("work"), db: chefBusyDb },
};
export const ReceiveWithAlerts: Story = {
  parameters: { ...at("cm-receive"), db: chefBusyDb },
};
export const Stock: Story = { parameters: { ...at("stock"), db: demoDb } };
export const History: Story = { parameters: { ...at("history"), db: demoDb } };
