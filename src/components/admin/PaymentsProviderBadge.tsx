import { CreditCard } from "lucide-react";
import { configuredProvider, providerEnvironment } from "@/lib/payments/config";
import { PROVIDER_LABELS } from "@/lib/payments/provider";
import { Badge } from "@/components/ui";

const ENVIRONMENT = {
  live: { label: "producción", variant: "success" },
  test: { label: "credenciales de prueba", variant: "new" },
  mock: { label: "simulado", variant: "warning" },
  unconfigured: { label: "sin configurar", variant: "danger" },
} as const;

/**
 * Who takes new orders' payments (PAYMENT_PROVIDER) and how it runs on this
 * server: production or test credentials, the simulated provider, or none.
 * Server Component: read from the environment on each request.
 */
export function PaymentsProviderBadge() {
  const provider = configuredProvider();
  const environment = ENVIRONMENT[providerEnvironment(provider)];
  return (
    <Badge variant={environment.variant} data-testid="admin-payments-provider" data-provider={provider}>
      <CreditCard aria-hidden="true" />
      Pagos: {PROVIDER_LABELS[provider]} · {environment.label}
    </Badge>
  );
}
