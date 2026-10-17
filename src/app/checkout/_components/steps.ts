import type { CheckoutStep } from "@/types";

/** The wizard's steps in order (the confirmation is not a step of the stepper). */
export const WIZARD_STEPS = [
  { id: "shipping", label: "Envío" },
  { id: "payment", label: "Pago" },
  { id: "review", label: "Revisar" },
] as const satisfies readonly { id: CheckoutStep; label: string }[];

/** Position of a step (the confirmation comes after the last one). */
export const stepIndex = (step: CheckoutStep) =>
  step === "confirmation" ? WIZARD_STEPS.length : WIZARD_STEPS.findIndex((s) => s.id === step);
