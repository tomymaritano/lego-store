import type { Preview } from "@storybook/nextjs-vite";
import { withThemeByClassName } from "@storybook/addon-themes";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import { transitions } from "@/lib/motion";
import "../src/app/globals.css";

const preview: Preview = {
  decorators: [
    // Toolbar toggle: adds/removes `dark` on <html>, like the app does.
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
    }),
    (Story) => (
      // Same motion setup as the app's ClientProviders (features loaded eagerly here).
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user" transition={transitions.base}>
          <div className="bg-bg p-4 text-fg">
            <Story />
          </div>
        </MotionConfig>
      </LazyMotion>
    ),
  ],
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Fail story tests (vitest storybook project / CI) on any axe violation.
      test: "error",
    },
  },
};

export default preview;
