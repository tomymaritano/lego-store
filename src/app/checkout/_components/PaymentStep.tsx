"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft, CreditCard, Lock } from "lucide-react";
import { scaleIn } from "@/lib/motion";
import { CARD_BRAND_LABELS, cvvLength, detectCardBrand, formatCardNumber, formatExpiry, onlyDigits } from "@/lib/card";
import { paymentSchema } from "@/lib/validations";
import { Button, Field, Input } from "@/components/ui";
import type { PaymentInfo, PaymentSummary } from "@/types";
import { RequiredNote } from "./RequiredNote";
import { StepCount, StepPanel } from "./StepPanel";

interface PaymentStepProps {
  /** What a previous visit to this step left (never the card number or CVV). */
  summary: PaymentSummary | null;
  focusHeading: boolean;
  onSubmit: (data: PaymentInfo) => void;
  onBack: () => void;
}

type MaskedField = "cardNumber" | "expiryDate" | "cvv";

/**
 * Step 2: card details (mock; the backend replaces this form with Stripe's
 * Payment Element). The full number and CVV live only in this form's state
 * while the step is mounted: the parent receives them on submit and keeps
 * just a summary (brand, last 4, name, expiry).
 */
export function PaymentStep({ summary, focusHeading, onSubmit, onBack }: PaymentStepProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInfo>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { cardNumber: "", cardName: summary?.cardName ?? "", expiryDate: summary?.expiryDate ?? "", cvv: "" },
    mode: "onTouched",
  });

  const cardNumber = useWatch({ control, name: "cardNumber" });
  const brand = detectCardBrand(cardNumber);
  const securityDigits = cvvLength(brand);

  /** register() plus an input mask: the form value is always the formatted string. */
  const masked = (name: MaskedField, format: (value: string) => string) =>
    register(name, {
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = format(event.target.value);
        if (value !== event.target.value) setValue(name, value, { shouldValidate: Boolean(errors[name]) });
      },
    });

  return (
    <StepPanel
      titleId="payment-title"
      title="Pago"
      icon={<CreditCard />}
      focusHeading={focusHeading}
      aside={<StepCount index={1} total={3} />}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="payment-title" className="space-y-5">
        <Field
          label="Número de tarjeta"
          required
          error={errors.cardNumber?.message}
          hint={
            summary
              ? `Por seguridad, vuelve a ingresar la tarjeta terminada en ${summary.last4}.`
              : "Visa, Mastercard o American Express."
          }
        >
          <Input
            inputMode="numeric"
            autoComplete="cc-number"
            spellCheck={false}
            maxLength={19}
            placeholder="1234 5678 9012 3456"
            className="pr-28 font-mono tabular-nums"
            rightIcon={
              <AnimatePresence mode="popLayout" initial={false}>
                {brand !== "unknown" && (
                  <motion.span
                    key={brand}
                    variants={scaleIn}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    data-testid="card-brand"
                    className="rounded-md bg-bg-muted px-2 py-0.5 text-caption font-bold text-fg"
                  >
                    {brand === "amex" ? "Amex" : CARD_BRAND_LABELS[brand]}
                  </motion.span>
                )}
              </AnimatePresence>
            }
            {...masked("cardNumber", formatCardNumber)}
          />
        </Field>

        <Field label="Nombre en la tarjeta" required error={errors.cardName?.message}>
          <Input autoComplete="cc-name" autoCapitalize="characters" placeholder="Como aparece en la tarjeta" {...register("cardName")} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Vencimiento" required error={errors.expiryDate?.message} hint="MM/AA">
            <Input
              inputMode="numeric"
              autoComplete="cc-exp"
              maxLength={5}
              placeholder="MM/AA"
              className="font-mono tabular-nums"
              {...masked("expiryDate", formatExpiry)}
            />
          </Field>
          <Field
            label="Código de seguridad"
            required
            error={errors.cvv?.message}
            hint={`${securityDigits} dígitos ${brand === "amex" ? "al frente" : "al dorso"}`}
          >
            <Input
              inputMode="numeric"
              autoComplete="cc-csc"
              maxLength={securityDigits}
              placeholder={"•".repeat(securityDigits)}
              className="font-mono tabular-nums"
              {...masked("cvv", (value) => onlyDigits(value).slice(0, securityDigits))}
            />
          </Field>
        </div>

        <p className="flex items-start gap-3 rounded-xl bg-bg-subtle p-4 text-sm text-fg-secondary">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            Pago protegido con cifrado. Esta tienda es una demo: no se cobra nada ni se guardan los datos de la tarjeta.
            Puedes probar con <span className="font-mono text-fg">4242 4242 4242 4242</span>.
          </span>
        </p>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" type="button" onClick={onBack}>
            <ChevronLeft aria-hidden="true" />
            Volver a envío
          </Button>
          <div className="flex flex-col-reverse items-center gap-3 sm:flex-row">
            <RequiredNote />
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
              Revisar pedido
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </form>
    </StepPanel>
  );
}
