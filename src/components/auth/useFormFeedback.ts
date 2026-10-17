"use client";

import { useEffect, useRef } from "react";
import type { FormState } from "@/lib/auth/form-state";

/**
 * After each submission, moves focus to the first invalid field (its error is
 * read with it, via aria-describedby). Form-level messages are announced by
 * their own role="alert" / role="status".
 */
export function useFocusFirstInvalid(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.fieldErrors || Object.keys(state.fieldErrors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);
  return formRef;
}
