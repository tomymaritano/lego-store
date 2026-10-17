"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, m } from "motion/react";
import { CheckCircle2, Send } from "lucide-react";
import { fadeInUp } from "@/lib/motion";
import { simulateRequest } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { validateNewsletterEmail } from "@/lib/validations/newsletter";
import { Button, Field, Input, showToast } from "@/components/ui";

interface NewsletterFormProps {
  className?: string;
  /**
   * Id of the heading that names the form. Each placement (Footer, home)
   * passes its own section heading, so two forms on one page never share a
   * landmark name; without it the form stays an unnamed (non-landmark) form.
   */
  labelledBy?: string;
}

/**
 * Newsletter sign-up (mock: validates, simulates the request and confirms
 * with a toast plus an inline message). Used by the Footer and the home page.
 * Deliberately dependency-free (no zod / react-hook-form): it renders in the
 * root layout, so whatever it imports ships on every route.
 */
export function NewsletterForm({ className, labelledBy }: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const result = validateNewsletterEmail(email);
    if (!result.ok) {
      setError(result.error);
      event.currentTarget.querySelector("input")?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await simulateRequest();
      setEmail("");
      setSubscribed(result.email);
      showToast.success("¡Listo! Te enviamos tu cupón de 10% de descuento");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn("w-full lg:w-auto", className)}>
      <form
        onSubmit={onSubmit}
        noValidate
        aria-labelledby={labelledBy}
        className="flex w-full flex-col gap-3 sm:flex-row sm:items-start"
      >
        <Field label="Tu email" hideLabel error={error ?? undefined} className="sm:min-w-72">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSubscribed(null);
              // Clear a shown error as soon as the value becomes valid.
              if (error && validateNewsletterEmail(event.target.value).ok) setError(null);
            }}
          />
        </Field>
        <Button type="submit" variant="secondary" className="whitespace-nowrap" loading={submitting}>
          {submitting ? null : <Send aria-hidden="true" />}
          {submitting ? "Enviando…" : "Suscribirse"}
        </Button>
      </form>
      <div role="status">
        <AnimatePresence>
          {subscribed ? (
            <m.p
              key="ok"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mt-2 flex items-center gap-2 text-sm font-medium text-success"
            >
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              Suscribimos {subscribed}. Revisa tu correo.
            </m.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
