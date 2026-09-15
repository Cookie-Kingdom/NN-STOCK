import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../src/**/*.stories.tsx"],
  staticDirs: ["../public"],
  // Running `next dev`/`next build` alongside rewrites .next; don't reload Storybook for it.
  viteFinal: (config) => ({
    ...config,
    server: {
      ...config.server,
      watch: { ...config.server?.watch, ignored: ["**/.next/**"] },
    },
  }),
};

export default config;
