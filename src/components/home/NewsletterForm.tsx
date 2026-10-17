"use client";

import { useState } from "react";
import { z } from "zod";
import { Button, Field, Input, showToast } from "@/components/ui";

const emailSchema = z.email("Ingresa un email válido");

/** Newsletter sign-up (mock: validates and confirms with a toast). */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = emailSchema.safeParse(email.trim());
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setEmail("");
    showToast.success("¡Listo! Te enviamos tu cupón de 10% de descuento");
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-3 sm:flex-row sm:items-start lg:w-auto">
      <Field label="Tu email" hideLabel error={error} className="sm:min-w-72">
        <Input
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Button type="submit" variant="secondary" className="whitespace-nowrap">
        Suscribirse
      </Button>
    </form>
  );
}
