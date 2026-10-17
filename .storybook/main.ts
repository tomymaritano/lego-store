import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-themes",
    "@storybook/addon-onboarding"
  ],
  "framework": "@storybook/nextjs-vite",
  "staticDirs": [
    "../public"
  ],
  // The static Storybook bundles every story and addon; its large preview
  // chunks are expected (it is a dev tool, not the store's bundle).
  viteFinal: async (config) => ({
    ...config,
    build: { ...config.build, chunkSizeWarningLimit: 2000 },
  }),
};
export default config;