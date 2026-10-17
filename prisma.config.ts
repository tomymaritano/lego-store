import { defineConfig } from "prisma/config";
import { loadEnv } from "./prisma/env";

loadEnv();

/*
 * Prisma CLI configuration (Prisma 7: the connection URL lives here, not in
 * schema.prisma). `prisma generate` does not need a database, so a missing
 * DATABASE_URL only fails the commands that connect.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
