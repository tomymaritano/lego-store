import { Check, X } from "lucide-react";
import { formatOrderDateTime, orderTimeline } from "@/lib/orders/format";
import type { OrderView } from "@/lib/orders/types";
import { cn } from "@/lib/utils";

/**
 * The order's progress as an ordered list: placed → paid → shipped →
 * delivered, or the steps it reached and then "Cancelado". The current step
 * carries aria-current; each reached step shows when it happened.
 */
export function OrderTimeline({ order }: { order: OrderView }) {
  const steps = orderTimeline(order);
  return (
    <ol aria-label="Estado del pedido" className="grid gap-4 sm:auto-cols-fr sm:grid-flow-col sm:gap-0" data-testid="order-timeline">
      {steps.map((step, index) => {
        const reached = step.state === "done" || step.state === "current";
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex items-start gap-3 sm:flex-col sm:items-center sm:px-2 sm:text-center"
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-8 -bottom-4 left-[0.9375rem] w-0.5 sm:top-[0.9375rem] sm:bottom-auto sm:left-1/2 sm:h-0.5 sm:w-full",
                  steps[index + 1]!.state === "upcoming" ? "bg-border" : "bg-success"
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 [&_svg]:size-4",
                step.state === "cancelled"
                  ? "border-danger bg-danger text-on-danger"
                  : reached
                    ? "border-success bg-success text-on-success"
                    : "border-border-strong bg-surface text-fg-muted"
              )}
            >
              {step.state === "cancelled" ? <X /> : reached ? <Check /> : <span className="size-2 rounded-full bg-border-strong" />}
            </span>
            <span className="flex flex-col">
              <span className={cn("text-label", reached || step.state === "cancelled" ? "font-semibold text-fg" : "font-normal text-fg-muted")}>
                {step.label}
                {step.state === "upcoming" ? <span className="sr-only"> (pendiente)</span> : null}
              </span>
              {step.at ? <span className="text-caption text-fg-muted">{formatOrderDateTime(step.at)}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
