/**
 * Stand-in for a network request in the mock forms (newsletter, contact)
 * until the backend exists: resolves after a short, realistic delay so the
 * loading state is visible.
 */
export function simulateRequest(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
