"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MailCheck, MailPlus } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { Button, EmptyState } from "@/components/ui";

type Outcome = "confirmed" | "invalid" | "rate_limited";

interface ConfirmSubscriptionFormProps {
  token: string;
  /** The address, partly hidden ("an***@example.com"). */
  email: string;
  action: (token: string) => Promise<Outcome>;
}

const focusOnMount = (element: HTMLElement | null) => element?.focus();

/**
 * The confirmation page of an address that unsubscribed and was signed up
 * again: one button (a POST through the Server Action), then the result,
 * announced by moving the focus to it. Same shape as UnsubscribeForm.
 */
export function ConfirmSubscriptionForm({ token, email, action }: ConfirmSubscriptionFormProps) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();

  if (outcome === "confirmed") {
    return (
      <div ref={focusOnMount} tabIndex={-1} className="outline-none" data-testid="confirm-subscription-done">
        <EmptyState
          headingLevel="h2"
          icon={<MailCheck />}
          title="Listo: volviste al newsletter"
          description={`Te vamos a escribir a ${email} con lanzamientos, ofertas y novedades. Cada email trae el enlace para darte de baja.`}
          action={
            <Button variant="secondary" render={<Link href="/" />}>
              Volver a la tienda
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-bg-muted text-fg-muted [&_svg]:size-9">
        <MailPlus />
      </span>
      <p className="max-w-md text-body text-fg-secondary">
        Vas a volver a recibir el newsletter en <strong className="text-fg">{email}</strong>. Si no lo pediste tú, cierra esta página: sigues dado de baja.
      </p>
      {outcome === "invalid" || outcome === "rate_limited" || failed ? (
        <p role="alert" className="text-label font-medium text-danger">
          {outcome === "rate_limited"
            ? "Demasiados intentos seguidos. Espera un rato y vuelve a intentarlo."
            : outcome === "invalid"
              ? "El enlace ya no es válido. Suscríbete otra vez desde el pie de cualquier página."
              : "No pudimos confirmar tu suscripción. Revisa tu conexión e inténtalo de nuevo."}
        </p>
      ) : null}
      <Button
        type="button"
        loading={pending}
        disabled={!hydrated}
        onClick={() =>
          startTransition(async () => {
            setFailed(false);
            try {
              setOutcome(await action(token));
            } catch {
              setFailed(true);
            }
          })
        }
      >
        {pending ? "Confirmando…" : "Confirmar la suscripción"}
      </Button>
    </div>
  );
}
