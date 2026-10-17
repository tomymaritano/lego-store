// @vitest-environment node
import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { MAX_PASSWORD_BYTES, hashPassword, isPasswordTooLong, verifyPassword } from "@/lib/auth/password";

describe("password hashing (bcrypt's 72-byte limit)", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(isPasswordTooLong("a".repeat(MAX_PASSWORD_BYTES))).toBe(false);
    expect(isPasswordTooLong("a".repeat(MAX_PASSWORD_BYTES + 1))).toBe(true);
    // "ñ" is 2 bytes: 37 of them are 74 bytes.
    expect(isPasswordTooLong("ñ".repeat(37))).toBe(true);
  });

  it("refuses to hash a password bcrypt would truncate", async () => {
    await expect(hashPassword("a".repeat(72) + "REAL-SECRET")).rejects.toThrow(/72 bytes/);
  });

  it("never accepts a longer password that shares the first 72 bytes of a stored one", async () => {
    // A hash of the 72-byte prefix (what bcrypt keeps of any longer input); cost 4 keeps the test fast.
    const prefix = "a".repeat(72);
    const hash = await bcrypt.hash(prefix, 4);
    expect(await verifyPassword(prefix, hash)).toBe(true);
    expect(await verifyPassword(prefix + "attacker", hash)).toBe(false);
  });
});
