"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/form-state";
import { Button, Field, Input } from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";
import { useFocusFirstInvalid } from "@/components/auth/useFormFeedback";

export interface ProfileFormProps {
  action: (state: FormState<"name">, formData: FormData) => Promise<FormState<"name">>;
  name: string;
  email: string;
}

/** /account: the name shown on the account (the email is the login and stays fixed). */
export function ProfileForm({ action, name, email }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useFocusFirstInvalid(state);

  return (
    <form ref={formRef} action={formAction} noValidate aria-labelledby="profile-title" className="space-y-5">
      {state.message ? <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert> : null}
      <Field label="Nombre" error={state.fieldErrors?.name} required>
        <Input name="name" autoComplete="name" defaultValue={state.values?.name ?? name} />
      </Field>
      <Field label="Email" hint="Es tu usuario para ingresar; no se puede cambiar.">
        <Input type="email" value={email} readOnly className="bg-bg-subtle text-fg-secondary" />
      </Field>
      <Button type="submit" loading={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
