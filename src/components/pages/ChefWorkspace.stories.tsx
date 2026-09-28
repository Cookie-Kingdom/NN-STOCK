import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  chefBusyDb,
  chefOpenedDb,
  chefPoLaterDb,
  demoDb,
  smokedDb,
} from "../../../.storybook/fixtures";
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

const alerts = pick("สถานะ", {
  ปกติ: smokedDb,
  มีงานรอ: chefBusyDb,
  "เปิดชุดเอง ยังไม่มี PO": chefOpenedDb,
  "Owner ออก PO ทีหลัง": chefPoLaterDb,
});

/** Pick สถานะ in Controls: ปกติ, มีงานรอ (the same busy bell as `Work`), or one of the
 *  batches Chef House opened itself. "เปิดชุดใหม่" is always in the heading. */
export const Receive: Story = {
  parameters: at("cm-receive"),
  argTypes: { db: alerts.argType },
  args: { db: alerts.initial },
};
/** Pick สถานะ in Controls:
 *  - มีงานรอ: one shipment at the door with its smoke PO still unaccepted (accept it and
 *    weigh it in from the same row), and a closed run with an invoice the Owner sent back.
 *  - เปิดชุดเอง ยังไม่มี PO: Chef House's own batch, weighed in and pre-smoke weighed,
 *    badge "ยังไม่มี PO รมควัน", every job still a button.
 *  - Owner ออก PO ทีหลัง: that batch billed before the PO; the PO now shows and the bell
 *    asks Chef House to accept it.
 *  Open the bell in the header. */
export const Work: Story = {
  parameters: at("work"),
  argTypes: { db: alerts.argType },
  args: { db: alerts.initial },
};
export const Stock: Story = { parameters: { ...at("stock"), db: demoDb } };
export const History: Story = { parameters: { ...at("history"), db: demoDb } };
