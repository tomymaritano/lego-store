import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Reset localStorage before each test (absent in node-environment tests)
beforeEach(() => {
  globalThis.localStorage?.clear();
});

// jsdom has no IntersectionObserver (motion's whileInView needs one): a no-op stub.
if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.assign(window, { IntersectionObserver: IntersectionObserverStub });
}

// The app renders motion's light `m.*` elements under <LazyMotion> (ClientProviders),
// which loads the animation features asynchronously. Components tested on
// their own have no LazyMotion around them, so map `m` to the full `motion`
// (same API, features bundled) and make LazyMotion a passthrough.
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    m: actual.motion,
    LazyMotion: ({ children }: { children: React.ReactNode }) => children,
  };
});
