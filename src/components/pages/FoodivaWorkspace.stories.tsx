import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, within } from "storybook/test";
import {
  demoDb,
  dispatchDb,
  foodivaTasksDb,
} from "../../../.storybook/fixtures";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
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
type Story = StoryObj;

export const WaitingForDispatch: Story = { parameters: at("foodiva") };
export const Completed: Story = {
  parameters: { ...at("foodiva"), db: demoDb },
};
export const History: Story = { parameters: { ...at("history"), db: demoDb } };

/** The bell with everything Foodiva still owes: a PO to invoice, a Request to truck and
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
