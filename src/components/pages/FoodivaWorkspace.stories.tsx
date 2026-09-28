import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, within } from "storybook/test";
import {
  demoDb,
  dispatchDb,
  foodivaBatchesDb,
  foodivaTasksDb,
} from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import type { Database } from "@/lib/store";
import { FoodivaWorkspace } from "./FoodivaWorkspace";

// See OwnerWorkspace.stories.tsx for why each story sets the URL segment.
const at = (tab: Tab) => ({ nextjs: { navigation: { segments: [tab] } } });

const meta: Meta = {
  title: "Pages/Foodiva",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: dispatchDb },
  render: () => <FoodivaWorkspace account={accountById("foodiva")!} />,
};

export default meta;
type Story = StoryObj<{ db: Database }>;

const workState = pick("สถานะ", {
  รอส่ง: dispatchDb,
  ชุดหลายแบบ: foodivaBatchesDb,
  เสร็จแล้ว: demoDb,
});

/** Foodiva's work tab. Pick สถานะ in Controls:
 *  - รอส่ง: a smoke PO waiting for Foodiva's transport document.
 *  - ชุดหลายแบบ: a batch Foodiva opened with no smoke PO, a smoke PO waiting for its
 *    truck, and smoked meat weighed in before the return truck was on file.
 *  - เสร็จแล้ว: every step done (the 7-day roleplay). */
export const WaitingForDispatch: Story = {
  parameters: at("foodiva"),
  argTypes: { db: workState.argType },
  args: { db: workState.initial },
};
export const History: Story = { parameters: { ...at("history"), db: demoDb } };

/** The bell with everything Foodiva still owes: a PO to invoice, a smoke PO to truck and
 *  smoked meat on the return truck to weigh in. Every line opens the work tab. */
export const Notifications: Story = {
  parameters: { ...at("foodiva"), db: foodivaTasksDb },
  play: async ({ canvasElement }) => {
    fireEvent.click(
      within(canvasElement).getByLabelText(/^การแจ้งเตือน/, {
        selector: "button",
      }),
    );
  },
};
