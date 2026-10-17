/**
 * Brand colours for generated images (Open Graph, app icons). ImageResponse
 * renders outside the page, without the CSS variables in globals.css, so it
 * needs literal values: these mirror the primitives there (--yellow-400,
 * --red-500, --stone-925, --stone-0).
 */
export const brand = {
  yellow: "#ffd44a",
  red: "#e53935",
  ink: "#1c1917",
  white: "#ffffff",
  /** Bottom edge shading of a brick. */
  shade: "rgba(0,0,0,0.18)",
} as const;
