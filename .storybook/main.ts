import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig } from "vite";

const mock = (name: string) =>
  fileURLToPath(new URL(`./mocks/${name}.ts`, import.meta.url));

const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../src/**/*.stories.tsx"],
  viteFinal: (config) =>
    mergeConfig(config, {
      resolve: {
        // Both modules create the Supabase client at import; swap in-memory versions.
        alias: [
          { find: /^@\/lib\/persistence$/, replacement: mock("persistence") },
          { find: /^@\/lib\/session$/, replacement: mock("session") },
          // Server code the story fixtures run (manager-scope.ts) imports it; Vite's
          // browser stand-in throws at import.
          { find: /^node:util$/, replacement: mock("node-util") },
        ],
      },
      // Running `next dev`/`next build` alongside rewrites .next; don't reload Storybook for it.
      server: { watch: { ignored: ["**/.next/**"] } },
    }),
};

export default config;
