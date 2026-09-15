import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SignInPage from "@/app/page";

// The mocked session is already signed in, so the redirect to the workspace only logs in Actions.
const meta: Meta = {
  title: "Pages/SignIn",
  component: SignInPage,
  parameters: { layout: "fullscreen" },
};

export default meta;

export const Default: StoryObj = {};
