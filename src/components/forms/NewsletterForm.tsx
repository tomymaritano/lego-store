"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Send } from "lucide-react";
import { fadeInUp } from "@/lib/motion";
import { simulateRequest } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { newsletterSchema, type NewsletterInput } from "@/lib/validations";
import { Button, Field, Input, showToast } from "@/components/ui";

/**
 * Newsletter sign-up (mock: validates, simulates the request and confirms
 * with a toast plus an inline message). Used by the Footer and the home page.
 */
export function NewsletterForm({ className }: { className?: string }) {
  const [subscribed, setSubscribed] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterInput>({ resolver: zodResolver(newsletterSchema), defaultValues: { email: "" } });

  const onSubmit = async ({ email }: NewsletterInput) => {
    await simulateRequest();
    reset();
    setSubscribed(email);
    showToast.success("¡Listo! Te enviamos tu cupón de 10% de descuento");
  };

  return (
    <div className={cn("w-full lg:w-auto", className)}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label="Suscripción al newsletter"
        className="flex w-full flex-col gap-3 sm:flex-row sm:items-start"
      >
        <Field label="Tu email" hideLabel error={errors.email?.message} className="sm:min-w-72">
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="tu@email.com"
            {...register("email", { onChange: () => setSubscribed(null) })}
          />
        </Field>
        <Button type="submit" variant="secondary" className="whitespace-nowrap" loading={isSubmitting}>
          {isSubmitting ? null : <Send aria-hidden="true" />}
          {isSubmitting ? "Enviando…" : "Suscribirse"}
        </Button>
      </form>
      <div role="status">
        <AnimatePresence>
          {subscribed ? (
            <motion.p
              key="ok"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mt-2 flex items-center gap-2 text-sm font-medium text-success"
            >
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              Suscribimos {subscribed}. Revisa tu correo.
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
