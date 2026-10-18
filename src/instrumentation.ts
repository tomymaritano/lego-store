/**
 * Runs once when a server instance starts (Next.js instrumentation hook).
 * Warns about production settings that are legal but risky.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { untrustedIpWarning } = await import("@/lib/rate-limit/client-ip");
  const warning = untrustedIpWarning();
  if (warning) console.warn(warning);
}
