"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Send } from "lucide-react";
import { fadeInUp, scaleIn } from "@/lib/motion";
import { simulateRequest } from "@/lib/forms";
import { CONTACT_MESSAGE_MAX, CONTACT_TOPICS, contactSchema, type ContactInput } from "@/lib/validations";
import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  showToast,
} from "@/components/ui";

/** Moves focus to the confirmation heading when it appears (announces it). */
const focusOnMount = (element: HTMLElement | null) => element?.focus();

const defaultValues: ContactInput = { name: "", email: "", topic: "", orderNumber: "", message: "" };

/**
 * /contacto form (mock submit). Validates on submit and then on change,
 * moves focus to the first invalid field, and swaps to a confirmation panel
 * (focus moves to its heading) once "sent".
 */
export function ContactForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema), defaultValues, mode: "onTouched" });

  const messageLength = useWatch({ control, name: "message" })?.length ?? 0;

  const onSubmit = async (data: ContactInput) => {
    await simulateRequest();
    setSentTo(data.email);
    reset(defaultValues);
    showToast.success("Recibimos tu mensaje. Te responderemos en 24 horas hábiles.");
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sentTo ? (
        <motion.div
          key="sent"
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-bg-subtle px-6 py-12 text-center"
        >
          <span
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-full bg-success text-on-success"
          >
            <CheckCircle2 className="size-8" />
          </span>
          <h2 ref={focusOnMount} tabIndex={-1} className="text-title outline-none">
            ¡Mensaje enviado!
          </h2>
          <p className="max-w-sm text-fg-secondary">
            Te escribiremos a <strong className="text-fg">{sentTo}</strong> dentro de las próximas 24 horas hábiles.
          </p>
          <Button variant="secondary" className="mt-2" onClick={() => setSentTo(null)}>
            Enviar otro mensaje
          </Button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          exit="exit"
          noValidate
          aria-labelledby="contact-form-title"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >
          <h2 id="contact-form-title" className="text-title">
            Escríbenos
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nombre" required error={errors.name?.message}>
              <Input autoComplete="name" {...register("name")} />
            </Field>
            <Field label="Email" required error={errors.email?.message}>
              <Input type="email" inputMode="email" autoComplete="email" {...register("email")} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Motivo" required error={errors.topic?.message}>
              <Controller
                control={control}
                name="topic"
                render={({ field }) => (
                  <Select
                    items={CONTACT_TOPICS}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    onOpenChange={(open) => {
                      if (!open) field.onBlur();
                    }}
                  >
                    <SelectTrigger ref={field.ref} name={field.name}>
                      <SelectValue placeholder="Elige una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TOPICS.map((topic) => (
                        <SelectItem key={topic.value} value={topic.value}>
                          {topic.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="Número de pedido"
              hint="Opcional. Lo encuentras en el email de confirmación."
              error={errors.orderNumber?.message}
            >
              <Input placeholder="Ej.: LS-12345" {...register("orderNumber")} />
            </Field>
          </div>

          <Field
            label="Mensaje"
            required
            error={errors.message?.message}
            hint={`${messageLength} / ${CONTACT_MESSAGE_MAX} caracteres`}
          >
            <Textarea rows={6} maxLength={CONTACT_MESSAGE_MAX} {...register("message")} />
          </Field>

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-fg-muted">
              <span aria-hidden="true" className="text-danger">
                *
              </span>{" "}
              Campos obligatorios
            </p>
            <Button type="submit" size="lg" loading={isSubmitting}>
              {isSubmitting ? null : <Send aria-hidden="true" />}
              {isSubmitting ? "Enviando…" : "Enviar mensaje"}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
