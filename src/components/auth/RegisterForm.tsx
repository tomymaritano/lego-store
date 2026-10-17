"use client";

import { useActionState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import type { FormState } from "@/lib/auth/form-state";
import { loginHref } from "@/lib/auth/callback-url";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import type { RegisterField } from "@/lib/validations/auth";
import { Button, Field, Input } from "@/components/ui";
import { FormAlert } from "./FormAlert";
import { GoogleSignIn } from "./GoogleSignIn";
import { PasswordInput } from "./PasswordInput";
import { useFocusFirstInvalid } from "./useFormFeedback";

export interface RegisterFormProps {
  action: (state: FormState<RegisterField>, formData: FormData) => Promise<FormState<RegisterField>>;
  callbackUrl: string;
  googleAction?: (formData: FormData) => Promise<void>;
}

/** Sign-up form: name, email, password and its confirmation. Validated on the server. */
export function RegisterForm({ action, callbackUrl, googleAction }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-6">
      <form ref={formRef} action={formAction} noValidate aria-labelledby="auth-title" className="space-y-5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        {state.message ? <FormAlert>{state.message}</FormAlert> : null}

        <Field label="Nombre" error={errors.name} required>
          <Input name="name" autoComplete="name" defaultValue={state.values?.name} />
        </Field>
        <Field label="Email" error={errors.email} required>
          <Input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state.values?.email} />
        </Field>
        <Field label="Contraseña" error={errors.password} hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`} required>
          <PasswordInput name="password" autoComplete="new-password" />
        </Field>
        <Field label="Repite la contraseña" error={errors.confirmPassword} required>
          <PasswordInput name="confirmPassword" autoComplete="new-password" />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? null : <UserPlus aria-hidden="true" />}
          {pending ? "Creando tu cuenta…" : "Crear cuenta"}
        </Button>
      </form>

      {googleAction ? <GoogleSignIn action={googleAction} callbackUrl={callbackUrl} /> : null}

      <p className="text-center text-body text-fg-secondary">
        ¿Ya tienes cuenta?{" "}
        <Link href={loginHref(callbackUrl)} className="font-semibold text-fg underline underline-offset-4 hover:no-underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
