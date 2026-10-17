import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isGoogleEnabled } from "@/lib/auth";
import { googleSignInAction } from "@/lib/auth/actions";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { firstParam, type SearchParams } from "@/lib/auth/search-params";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthNotConfigured } from "@/components/auth/AuthNotConfigured";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { registerAction } from "../actions";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de LEGO Store.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: true },
};

interface RegisterPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const callbackUrl = safeCallbackUrl(firstParam((await searchParams).callbackUrl));
  if (await getCurrentUser()) redirect(callbackUrl);

  return (
    <>
      <header className="mb-8">
        <h1 id="auth-title" className="text-headline">
          Crea tu cuenta
        </h1>
        <p className="mt-2 text-fg-secondary">Es gratis y te lleva un minuto.</p>
      </header>
      <AuthNotConfigured />
      <RegisterForm
        action={registerAction}
        callbackUrl={callbackUrl}
        googleAction={isGoogleEnabled() ? googleSignInAction : undefined}
      />
    </>
  );
}
