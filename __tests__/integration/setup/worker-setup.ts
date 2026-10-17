import { vi } from "vitest";
import { loadEnv } from "../../../prisma/env";
import { testDatabaseUrl } from "../../../prisma/test-database";

// Everything in the app that connects (lib/db) reads DATABASE_URL: point it at the test database.
loadEnv();
process.env.DATABASE_URL = testDatabaseUrl();

// No Next server here: the data cache is a pass-through and revalidations are recorded.
vi.mock("next/cache", () => ({
  unstable_cache:
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    (...args: A) =>
      fn(...args),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
