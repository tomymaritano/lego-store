import { Check, CreditCard, MapPin, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckoutStep } from "@/types";

const steps: { id: CheckoutStep; label: string; icon: typeof MapPin }[] = [
  { id: "shipping", label: "Envío", icon: MapPin },
  { id: "payment", label: "Pago", icon: CreditCard },
  { id: "review", label: "Revisar", icon: Package },
];

export function CheckoutProgress({ current }: { current: CheckoutStep }) {
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Pasos del checkout" className="mt-4 mb-8 flex justify-center">
      <ol className="flex items-center gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const Icon = isCompleted ? Check : step.icon;
          return (
            <li key={step.id} className="flex items-center" aria-current={isActive ? "step" : undefined}>
              <span
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 transition-colors duration-base ease-standard",
                  isActive && "bg-primary text-on-primary",
                  isCompleted && "bg-success text-on-success",
                  !isActive && !isCompleted && "bg-bg-muted text-fg-muted"
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span className="sr-only font-medium sm:not-sr-only">{step.label}</span>
                {isCompleted && <span className="sr-only"> (completado)</span>}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-2 h-1 w-8 rounded-sm transition-colors duration-base sm:w-12",
                    isCompleted ? "bg-success" : "bg-bg-muted"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
