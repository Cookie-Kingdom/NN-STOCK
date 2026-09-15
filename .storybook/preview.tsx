import { useEffect } from "react";
import type { Preview } from "@storybook/nextjs-vite";
import { Noto_Sans_Thai } from "next/font/google";
import "../src/app/globals.css";

// Same font setup as src/app/layout.tsx; the tokens read --font-noto-sans-thai off <html>.
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    controls: { expanded: true },
  },
  globalTypes: {
    theme: {
      description: "Light / dark tokens",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      const dark = context.globals.theme === "dark";
      useEffect(() => {
        const html = document.documentElement;
        html.lang = "th";
        html.classList.add(notoSansThai.variable, "antialiased");
        html.classList.toggle("dark", dark);
      }, [dark]);
      return <Story />;
    },
  ],
};

export default preview;
