import { deleteE2eAccounts } from "./helpers/db";

/** Removes the accounts this run created (see helpers/db.ts). */
export default async function globalTeardown() {
  await deleteE2eAccounts();
}
