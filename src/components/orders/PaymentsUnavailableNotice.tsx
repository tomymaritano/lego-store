import { PlugZap } from "lucide-react";
import type { PaymentsUnavailable } from "@/lib/payments/config";
import { PROVIDER_LABELS } from "@/lib/payments/provider";
import { cn } from "@/lib/utils";

/**
 * "Los pagos no están disponibles": the store cannot take payments (no
 * provider credentials). The cart and the checkout's first step show it, with
 * their buttons to go on disabled, so a customer learns it before typing their
 * address. Outside production it also names the variables to set.
 */
export function PaymentsUnavailableNotice({ unavailable, className }: { unavailable: PaymentsUnavailable; className?: string }) {
  return (
    <div role="status" className={cn("rounded-xl border border-border bg-bg-subtle p-4", className)} data-testid="payments-unavailable">
      <p className="flex items-center gap-2 font-semibold text-fg">
        <PlugZap aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
        Los pagos no están disponibles en este momento
      </p>
      <p className="mt-1 text-label font-normal text-fg-secondary">
        Todavía no puedes finalizar la compra: vuelve a intentarlo más tarde. Tu carrito queda guardado.
      </p>
      {unavailable.missing.length > 0 ? (
        <p className="mt-2 text-label font-normal text-fg-secondary">
          Este servidor no tiene {PROVIDER_LABELS[unavailable.provider]} configurado. Define{" "}
          <span className="font-mono text-fg">{unavailable.missing.join(", ")}</span> en <span className="font-mono text-fg">.env.local</span> (ver
          docs/payments.md) y reinicia el servidor.
        </p>
      ) : null}
    </div>
  );
}
