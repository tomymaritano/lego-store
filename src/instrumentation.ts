/**
 * Runs once when a server instance starts (Next.js instrumentation hook).
 * Warns about settings that are legal but risky (production IP trust, mock payments).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { untrustedIpWarning } = await import("@/lib/rate-limit/client-ip");
  const { mockPaymentsWarning } = await import("@/lib/payments/config");
  for (const warning of [untrustedIpWarning(), mockPaymentsWarning()]) {
    if (warning) console.warn(warning);
  }
}
