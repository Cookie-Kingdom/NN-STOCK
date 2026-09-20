import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SignIn } from "./SignIn";

// The mocked session is already signed in, so the redirect to the workspace only logs in Actions.
const meta = {
  title: "Pages/SignIn",
  component: SignIn,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SignIn>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
