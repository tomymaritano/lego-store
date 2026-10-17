import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthConfigured, isGoogleEnabled } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { getCurrentUser } from "@/lib/auth/session";
import { FormAlert } from "@/components/auth/FormAlert";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { googleSignInAction, registerAction } from "../actions";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de LEGO Store.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: true },
};

interface RegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const callbackUrl = safeCallbackUrl(first((await searchParams).callbackUrl));
  if (await getCurrentUser()) redirect(callbackUrl);

  return (
    <>
      <header className="mb-8">
        <h1 id="auth-title" className="text-headline">
          Crea tu cuenta
        </h1>
        <p className="mt-2 text-fg-secondary">Es gratis y te lleva un minuto.</p>
      </header>
      {isAuthConfigured() ? null : (
        <FormAlert className="mb-6">
          El ingreso no está configurado en este servidor: falta la variable AUTH_SECRET (ver README).
        </FormAlert>
      )}
      <RegisterForm
        action={registerAction}
        callbackUrl={callbackUrl}
        googleAction={isGoogleEnabled() ? googleSignInAction : undefined}
      />
    </>
  );
}
