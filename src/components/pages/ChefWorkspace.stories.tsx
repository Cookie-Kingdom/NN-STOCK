import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { chefBusyDb, demoDb, smokedDb } from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import type { Database } from "@/lib/store";
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
type Story = StoryObj<{ db: Database }>;

const alerts = pick("สถานะ", { ปกติ: smokedDb, มีงานรอ: chefBusyDb });

/** Pick สถานะ in Controls: ปกติ, or มีงานรอ: the same busy bell as `Work`. */
export const Receive: Story = {
  parameters: at("cm-receive"),
  argTypes: { db: alerts.argType },
  args: { db: alerts.initial },
};
/** Pick สถานะ in Controls: ปกติ, or มีงานรอ: one shipment at the door with its smoke PO
 *  still unaccepted (its row offers the PO button and the pointer to the receive tab),
 *  and a closed run with an invoice the Owner sent back. Open the bell in the header. */
export const Work: Story = {
  parameters: at("work"),
  argTypes: { db: alerts.argType },
  args: { db: alerts.initial },
};
export const Stock: Story = { parameters: { ...at("stock"), db: demoDb } };
export const History: Story = { parameters: { ...at("history"), db: demoDb } };
