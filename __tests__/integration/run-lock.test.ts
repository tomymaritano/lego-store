import { describe, expect, it } from "vitest";
import { Client } from "pg";
import { testDatabaseUrl } from "../../prisma/test-database";

describe("integration run lock (global setup)", () => {
  it("is held for the whole run, so a second run against the same database cannot start", async () => {
    const other = new Client({ connectionString: testDatabaseUrl() });
    await other.connect();
    try {
      const { rows } = await other.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock(hashtext('lego-store:integration-tests')) AS locked"
      );
      expect(rows[0].locked).toBe(false);
    } finally {
      await other.end();
    }
  });
});
