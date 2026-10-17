/**
 * Motion's animation features (animations, exit, gestures, layout, drag),
 * split out so ClientProviders can load them asynchronously through
 * <LazyMotion>. Components render `m.*` elements, which stay tiny in the
 * first-load bundle; the features arrive right after hydration.
 */
export { domMax as default } from "motion/react";
