"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MailX, MailCheck } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { Button, EmptyState } from "@/components/ui";

type Outcome = "unsubscribed" | "already" | "invalid" | "rate_limited";

interface UnsubscribeFormProps {
  token: string;
  /** The address, partly hidden ("an***@example.com"). */
  email: string;
  action: (token: string) => Promise<Outcome>;
}

const focusOnMount = (element: HTMLElement | null) => element?.focus();

/**
 * The unsubscribe page's confirmation: one button (a POST through the
 * Server Action), then the result, announced by moving the focus to it.
 */
export function UnsubscribeForm({ token, email, action }: UnsubscribeFormProps) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();

  if (outcome === "unsubscribed" || outcome === "already") {
    return (
      <div ref={focusOnMount} tabIndex={-1} className="outline-none" data-testid="unsubscribe-done">
        <EmptyState
          headingLevel="h2"
          icon={<MailCheck />}
          title={outcome === "unsubscribed" ? "Listo: te diste de baja" : "Ya estabas dado de baja"}
          description={`No vamos a enviar más el newsletter a ${email}. Si cambias de idea, puedes suscribirte otra vez desde el pie de cualquier página.`}
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
        <MailX />
      </span>
      <p className="max-w-md text-body text-fg-secondary">
        Vas a dejar de recibir el newsletter en <strong className="text-fg">{email}</strong>. Los emails de tus pedidos siguen llegando.
      </p>
      {outcome === "invalid" || outcome === "rate_limited" || failed ? (
        <p role="alert" className="text-label font-medium text-danger">
          {outcome === "rate_limited"
            ? "Demasiados intentos seguidos. Espera un rato y vuelve a intentarlo."
            : outcome === "invalid"
              ? "El enlace ya no es válido. Usa el del último email que recibiste."
              : "No pudimos darte de baja. Revisa tu conexión e inténtalo de nuevo."}
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
        {pending ? "Dando de baja…" : "Darme de baja"}
      </Button>
    </div>
  );
}
