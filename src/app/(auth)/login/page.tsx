import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthConfigured, isGoogleEnabled } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { getCurrentUser } from "@/lib/auth/session";
import { FormAlert } from "@/components/auth/FormAlert";
import { LoginForm } from "@/components/auth/LoginForm";
import { googleSignInAction, loginAction } from "../actions";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Ingresa a tu cuenta de LEGO Store.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(first(params.callbackUrl));
  // Already signed in: nothing to do here.
  if (await getCurrentUser()) redirect(callbackUrl);

  return (
    <>
      <header className="mb-8">
        <h1 id="auth-title" className="text-headline">
          Inicia sesión
        </h1>
        <p className="mt-2 text-fg-secondary">Ingresa con tu email y contraseña.</p>
      </header>
      {isAuthConfigured() ? null : (
        <FormAlert className="mb-6">
          El ingreso no está configurado en este servidor: falta la variable AUTH_SECRET (ver README).
        </FormAlert>
      )}
      <LoginForm
        action={loginAction}
        callbackUrl={callbackUrl}
        notice={authErrorMessage(first(params.error))}
        googleAction={isGoogleEnabled() ? googleSignInAction : undefined}
      />
    </>
  );
}
