import type { FormState } from "@/lib/auth/form-state";

/**
 * For stories and tests: a stand-in form Server Action that always answers
 * `state`, the way the real action does for one case.
 */
export const stubFormAction =
  <F extends string>(state: FormState<F>) =>
  async (): Promise<FormState<F>> =>
    state;
