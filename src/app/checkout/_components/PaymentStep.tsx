"use client";

import { motion } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, CreditCard, Lock } from "lucide-react";
import { stepSlide } from "@/lib/motion";
import { paymentSchema } from "@/lib/validations";
import { Button, Field, Input } from "@/components/ui";
import type { PaymentInfo, PaymentSummary } from "@/types";

interface PaymentStepProps {
  /** What a previous visit to this step left (never the card number or CVV). */
  summary: PaymentSummary | null;
  onSubmit: (data: PaymentInfo) => void;
  onBack: () => void;
}

const digits = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);
const formatCardNumber = (value: string) => digits(value, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (value: string) => {
  const d = digits(value, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/**
 * Card form. The full card data lives only in this form's state while the
 * step is mounted; on submit the parent stores just a summary.
 */
export function PaymentStep({ summary, onSubmit, onBack }: PaymentStepProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInfo>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { cardNumber: "", cardName: summary?.cardName ?? "", expiryDate: summary?.expiryDate ?? "", cvv: "" },
  });

  /** register() plus an input mask: the form value is always the formatted string. */
  const masked = (name: "cardNumber" | "expiryDate" | "cvv", format: (value: string) => string) =>
    register(name, {
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = format(event.target.value);
        if (value !== event.target.value) setValue(name, value, { shouldValidate: Boolean(errors[name]) });
      },
    });

  return (
    <motion.section
      aria-labelledby="payment-title"
      variants={stepSlide}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <h2 id="payment-title" className="mb-6 flex items-center gap-2 text-title">
        <CreditCard aria-hidden="true" className="size-6 text-info" />
        Información de pago
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field
          label="Número de tarjeta"
          required
          error={errors.cardNumber?.message}
          hint={summary ? `Por seguridad, vuelve a ingresar la tarjeta terminada en ${summary.last4}.` : undefined}
        >
          <Input
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 5678 9012 3456"
            {...masked("cardNumber", formatCardNumber)}
          />
        </Field>

        <Field label="Nombre en la tarjeta" required error={errors.cardName?.message}>
          <Input autoComplete="cc-name" placeholder="Como aparece en la tarjeta" {...register("cardName")} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Vencimiento" required error={errors.expiryDate?.message}>
            <Input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" {...masked("expiryDate", formatExpiry)} />
          </Field>
          <Field label="CVV" required error={errors.cvv?.message}>
            <Input
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              {...masked("cvv", (value) => digits(value, 4))}
            />
          </Field>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-bg-subtle p-4 text-sm text-fg-secondary">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Tus datos están protegidos con encriptación SSL de 256 bits. Esta es una demo: no se procesan pagos reales ni
          se guardan los datos de la tarjeta.
        </p>

        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
          <Button variant="ghost" type="button" onClick={onBack}>
            <ChevronLeft aria-hidden="true" />
            Volver
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            Revisar pedido
          </Button>
        </div>
      </form>
    </motion.section>
  );
}
