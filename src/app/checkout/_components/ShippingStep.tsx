"use client";

import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ChevronLeft, Truck } from "lucide-react";
import { ARGENTINA_PROVINCES, SHIPPING_COUNTRY } from "@/lib/argentina";
import { shippingSchema } from "@/lib/validations";
import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type { ShippingInfo } from "@/types";
import { RequiredNote } from "./RequiredNote";
import { StepCount, StepPanel } from "./StepPanel";

interface ShippingStepProps {
  initialData: ShippingInfo | null;
  focusHeading: boolean;
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
  country: SHIPPING_COUNTRY,
};

const provinceItems = ARGENTINA_PROVINCES.map((province) => ({ value: province, label: province }));

/**
 * Step 1: contact and delivery address. Validates on submit (focus goes to
 * the first invalid field) and then as each field is left.
 */
export function ShippingStep({ initialData, focusHeading, onSubmit }: ShippingStepProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShippingInfo>({
    resolver: zodResolver(shippingSchema),
    defaultValues: initialData ?? emptyShipping,
    mode: "onTouched",
  });

  return (
    <StepPanel
      titleId="shipping-title"
      title="Datos de envío"
      icon={<Truck />}
      focusHeading={focusHeading}
      aside={<StepCount index={0} total={3} />}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="shipping-title" className="space-y-5">
        <fieldset className="space-y-4">
          <legend className="mb-3 text-label font-semibold text-fg">Contacto</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={errors.firstName?.message}>
              <Input autoComplete="given-name" {...register("firstName")} />
            </Field>
            <Field label="Apellido" required error={errors.lastName?.message}>
              <Input autoComplete="family-name" {...register("lastName")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" required error={errors.email?.message} hint="Te enviaremos la confirmación del pedido.">
              <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} {...register("email")} />
            </Field>
            <Field label="Teléfono" required error={errors.phone?.message} hint="Con código de área, p. ej. 11 5555 1234.">
              <Input type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />
            </Field>
          </div>
        </fieldset>

        <hr className="border-border" />
        <fieldset className="space-y-4">
          <legend className="mb-3 text-label font-semibold text-fg">Dirección de entrega</legend>
          <Field label="Dirección" required error={errors.address?.message}>
            <Input autoComplete="street-address" placeholder="Calle y número, piso, depto." {...register("address")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ciudad" required error={errors.city?.message}>
              <Input autoComplete="address-level2" {...register("city")} />
            </Field>
            <Field label="Código postal" required error={errors.zipCode?.message}>
              <Input autoComplete="postal-code" autoCapitalize="characters" placeholder="1425" {...register("zipCode")} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provincia" required error={errors.state?.message}>
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Select
                    items={provinceItems}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    onOpenChange={(open) => {
                      if (!open) field.onBlur();
                    }}
                  >
                    <SelectTrigger ref={field.ref} name={field.name} data-testid="province-select">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinceItems.map((province) => (
                        <SelectItem key={province.value} value={province.value}>
                          {province.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="País" hint="Por ahora enviamos solo dentro de Argentina." error={errors.country?.message}>
              <Input readOnly autoComplete="country-name" className="bg-bg-subtle" {...register("country")} />
            </Field>
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" render={<Link href="/cart" />}>
            <ChevronLeft aria-hidden="true" />
            Volver al carrito
          </Button>
          <div className="flex flex-col-reverse items-center gap-3 sm:flex-row">
            <RequiredNote />
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
              Continuar al pago
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </form>
    </StepPanel>
  );
}
