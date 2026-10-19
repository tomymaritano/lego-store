"use client";

import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/lib/auth/form-state";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import type { PasswordField } from "@/lib/validations/auth";
import { Button, Field } from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useFocusFirstInvalid } from "@/components/auth/useFormFeedback";

export interface PasswordFormProps {
  action: (state: FormState<PasswordField>, formData: FormData) => Promise<FormState<PasswordField>>;
  /** Confirmation after a successful change (the action redirects back with it). */
  notice?: string;
  /**
   * Called once after `notice` is shown, to clear the one-time value behind it
   * (src/app/account/flash.ts). The form keeps showing the notice it mounted with.
   */
  onNoticeShown?: () => Promise<void>;
}

/**
 * /account: change the password (the current one is required). Saving it
 * signs out every other device; the form says so before and after. On
 * success the action redirects back here and the page passes `notice`.
 */
export function PasswordForm({ action, notice: initialNotice, onNoticeShown }: PasswordFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  // Latched: clearing the flash refreshes the page without it, and the notice should stay.
  const [notice, setNotice] = useState(initialNotice);
  if (initialNotice && initialNotice !== notice) setNotice(initialNotice);
  useEffect(() => {
    if (initialNotice && onNoticeShown) void onNoticeShown();
  }, [initialNotice, onNoticeShown]);
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate aria-labelledby="password-title" className="space-y-5">
      {state.message ? (
        <FormAlert>{state.message}</FormAlert>
      ) : notice && !state.status ? (
        <FormAlert tone="success">{notice}</FormAlert>
      ) : null}
      <Field label="Contraseña actual" error={errors.currentPassword} required>
        <PasswordInput name="currentPassword" autoComplete="current-password" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nueva contraseña" error={errors.newPassword} hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`} required>
          <PasswordInput name="newPassword" autoComplete="new-password" />
        </Field>
        <Field label="Repite la nueva contraseña" error={errors.confirmPassword} required>
          <PasswordInput name="confirmPassword" autoComplete="new-password" />
        </Field>
      </div>
      <Button type="submit" loading={pending}>
        {pending ? "Cambiando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
