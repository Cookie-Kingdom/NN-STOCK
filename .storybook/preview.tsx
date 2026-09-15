import { useEffect } from "react";
import type { Preview } from "@storybook/nextjs-vite";
import { Noto_Sans_Thai } from "next/font/google";
import "../src/app/globals.css";
import { setMockDatabase } from "./mocks/persistence";

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
    // The app uses the App Router; mocks next/navigation's useRouter & co.
    nextjs: { appDirectory: true },
    controls: { expanded: true },
    // Atomic Design order; folders would otherwise sort Pages before Templates.
    options: {
      storySort: {
        order: ["Atoms", "Molecules", "Organisms", "Templates", "Pages"],
      },
    },
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
      // Forms re-read the database via latestDatabase(); keep it equal to the story's `db`.
      const db = context.args.db ?? context.parameters.db;
      if (db) setMockDatabase(db);
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
