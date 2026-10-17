"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Truck } from "lucide-react";
import { stepSlide } from "@/lib/motion";
import { shippingSchema } from "@/lib/validations";
import { Button, Field, Input } from "@/components/ui";
import type { ShippingInfo } from "@/types";

interface ShippingStepProps {
  initialData: ShippingInfo | null;
  onSubmit: (data: ShippingInfo) => void;
}

const emptyShipping: ShippingInfo = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "Argentina",
};

export function ShippingStep({ initialData, onSubmit }: ShippingStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShippingInfo>({
    resolver: zodResolver(shippingSchema),
    defaultValues: initialData ?? emptyShipping,
  });

  return (
    <motion.section
      aria-labelledby="shipping-title"
      variants={stepSlide}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <h2 id="shipping-title" className="mb-6 flex items-center gap-2 text-title">
        <Truck aria-hidden="true" className="size-6 text-info" />
        Información de envío
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required error={errors.firstName?.message}>
            <Input autoComplete="given-name" {...register("firstName")} />
          </Field>
          <Field label="Apellido" required error={errors.lastName?.message}>
            <Input autoComplete="family-name" {...register("lastName")} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field label="Teléfono" required error={errors.phone?.message}>
            <Input type="tel" autoComplete="tel" {...register("phone")} />
          </Field>
        </div>

        <Field label="Dirección" required error={errors.address?.message}>
          <Input autoComplete="street-address" placeholder="Calle y número, piso, depto." {...register("address")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ciudad" required error={errors.city?.message}>
            <Input autoComplete="address-level2" {...register("city")} />
          </Field>
          <Field label="Provincia" required error={errors.state?.message}>
            <Input autoComplete="address-level1" {...register("state")} />
          </Field>
          <Field label="Código postal" required error={errors.zipCode?.message}>
            <Input autoComplete="postal-code" {...register("zipCode")} />
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
          <Button variant="ghost" render={<Link href="/cart" />}>
            <ChevronLeft aria-hidden="true" />
            Volver al carrito
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            Continuar al pago
          </Button>
        </div>
      </form>
    </motion.section>
  );
}
