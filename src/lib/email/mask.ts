/** "an***@example.com": what the unsubscribe page and the logs show of an address. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}
