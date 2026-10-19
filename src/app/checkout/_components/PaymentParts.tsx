"use client";

import { ArrowRight, ChevronLeft, Lock, PlugZap } from "lucide-react";
import { Button } from "@/components/ui";

/*
 * Pieces every provider's payment step shares: the footer (back to shipping,
 * "Revisar pedido"), the security note and the "not configured" state.
 */

export function PaymentFooter({ onBack, disabled = false, busy = false }: { onBack: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="ghost" type="button" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        Volver a envío
      </Button>
      <Button type="submit" size="lg" disabled={disabled} loading={busy} focusableWhenDisabled className="w-full sm:w-auto">
        Revisar pedido
        {busy ? null : <ArrowRight aria-hidden="true" />}
      </Button>
    </div>
  );
}

export function SecureNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 rounded-xl bg-bg-subtle p-4 text-label font-normal text-fg-secondary">
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
      <span>{children}</span>
    </p>
  );
}

export function PaymentsNotConfigured({ provider, missing, onBack }: { provider: string; missing: string[]; onBack: () => void }) {
  return (
    <form onSubmit={(event) => event.preventDefault()} aria-labelledby="payment-title" className="space-y-5">
      <div role="status" className="rounded-xl border border-border bg-bg-subtle p-5" data-testid="payments-not-configured">
        <p className="flex items-center gap-2 font-semibold text-fg">
          <PlugZap aria-hidden="true" className="size-5 text-fg-muted" />
          Pagos no configurados
        </p>
        {missing.length > 0 ? (
          <p className="mt-2 text-label font-normal text-fg-secondary">
            Este servidor no tiene {provider} configurado. Define <span className="font-mono text-fg">{missing.join(", ")}</span> en{" "}
            <span className="font-mono text-fg">.env.local</span> (ver docs/payments.md) y reinicia el servidor.
          </p>
        ) : (
          <p className="mt-2 text-label font-normal text-fg-secondary">Los pagos no están disponibles en este momento. Inténtalo más tarde.</p>
        )}
      </div>
      <PaymentFooter onBack={onBack} disabled />
    </form>
  );
}
