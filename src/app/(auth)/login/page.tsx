import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isGoogleEnabled } from "@/lib/auth";
import { googleSignInAction } from "@/lib/auth/actions";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { firstParam, type SearchParams } from "@/lib/auth/search-params";
import { authErrorMessage } from "@/lib/auth/error-messages";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthNotConfigured } from "@/components/auth/AuthNotConfigured";
import { LoginForm } from "@/components/auth/LoginForm";
import { loginAction } from "../actions";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Ingresa a tu cuenta de LEGO Store.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

interface LoginPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(firstParam(params.callbackUrl));
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
      <AuthNotConfigured />
      <LoginForm
        action={loginAction}
        callbackUrl={callbackUrl}
        notice={authErrorMessage(firstParam(params.error))}
        googleAction={isGoogleEnabled() ? googleSignInAction : undefined}
      />
    </>
  );
}
