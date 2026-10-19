"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import type { FormState } from "@/lib/auth/form-state";
import { loginHref } from "@/lib/auth/callback-url";
import type { LoginField } from "@/lib/validations/auth";
import { Button, Field, Input } from "@/components/ui";
import { FormAlert } from "./FormAlert";
import { GoogleSignIn } from "./GoogleSignIn";
import { PasswordInput } from "./PasswordInput";
import { useFocusFirstInvalid } from "./useFormFeedback";

export interface LoginFormProps {
  /** The login Server Action (a stub in stories and tests). */
  action: (state: FormState<LoginField>, formData: FormData) => Promise<FormState<LoginField>>;
  /** Same-site path to return to (already sanitised by the page). */
  callbackUrl: string;
  /** A message from the URL (e.g. a failed Google sign-in). */
  notice?: string;
  /** Google sign-in action; the button only shows when it is set. */
  googleAction?: (formData: FormData) => Promise<void>;
}

/**
 * Email + password login. Works without JavaScript (a plain form posting to a
 * Server Action); the server validates and answers with Spanish messages.
 */
export function LoginForm({ action, callbackUrl, notice, googleAction }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useFocusFirstInvalid(state);
  const message = state.message ?? (state.status ? undefined : notice);

  return (
    <div className="space-y-6">
      <form ref={formRef} action={formAction} noValidate aria-labelledby="auth-title" className="space-y-5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        {message ? <FormAlert>{message}</FormAlert> : null}

        <Field label="Email" error={state.fieldErrors?.email} required>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={state.values?.email}
          />
        </Field>
        <Field label="Contraseña" error={state.fieldErrors?.password} required>
          <PasswordInput name="password" autoComplete="current-password" />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? null : <LogIn aria-hidden="true" />}
          {pending ? "Ingresando…" : "Iniciar sesión"}
        </Button>
      </form>

      {googleAction ? <GoogleSignIn action={googleAction} callbackUrl={callbackUrl} /> : null}

      <p className="text-center text-body text-fg-secondary">
        ¿No tienes cuenta?{" "}
        <Link href={loginHref(callbackUrl, "/register")} className="font-semibold text-fg underline underline-offset-4 hover:no-underline">
          Crea una
        </Link>
      </p>
    </div>
  );
}
