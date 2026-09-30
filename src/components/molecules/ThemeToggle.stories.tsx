import { useEffect } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { setThemePref, type ThemePref } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

/** Sets the saved preference when the `pref` control changes. */
function PrefSync({ pref }: { pref: ThemePref }) {
  useEffect(() => {
    // ponytail: one frame late so the preview's toolbar-theme effect, which runs after
    // this one on mount, does not win the first paint.
    const id = requestAnimationFrame(() => setThemePref(pref));
    return () => cancelAnimationFrame(id);
  }, [pref]);
  return null;
}

/**
 * Press to switch สว่าง ↔ มืด (a first visit follows the OS theme). The choice is saved
 * in this browser's localStorage and applies the `.dark` class to the whole page, so it
 * overrides the toolbar Theme until the toolbar is switched again.
 */
const meta = {
  title: "Molecules/ThemeToggle",
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;

export default meta;

/** Pick `pref` in Controls: สว่าง shows the sun, มืด the moon; the label always names
 *  the theme a press switches to. */
export const Default: StoryObj<
  ComponentProps<typeof ThemeToggle> & { pref: ThemePref }
> = {
  argTypes: {
    pref: {
      options: ["light", "dark"],
      control: {
        type: "inline-radio",
        labels: { light: "สว่าง", dark: "มืด" },
      },
    },
  },
  args: { pref: "light" },
  render: ({ pref, ...args }) => (
    <>
      <PrefSync pref={pref} />
      <ThemeToggle {...args} />
    </>
  ),
};
