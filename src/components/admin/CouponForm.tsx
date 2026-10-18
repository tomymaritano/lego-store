"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import type { FormState } from "@/lib/auth/form-state";
import type { CouponField } from "@/lib/validations/coupons";
import { Button, Card, CardContent, CardDescription, CardHeader, Checkbox, Field, Input, RadioGroup, RadioGroupItem, showToast } from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";
import { useFocusFirstInvalid } from "@/components/auth/useFormFeedback";

/** What the form starts with: a coupon's current terms, or the defaults of a new one. Dates are store days (YYYY-MM-DD). */
export interface CouponFormValues {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: number | null;
  minSubtotal: number;
  startsAt: string;
  /** The last valid day (inclusive). */
  expiresAt: string;
  maxRedemptions: number | null;
  maxPerUser: number | null;
  active: boolean;
}

export const EMPTY_COUPON: CouponFormValues = {
  code: "",
  description: "",
  type: "PERCENT",
  value: null,
  minSubtotal: 0,
  startsAt: "",
  expiresAt: "",
  maxRedemptions: null,
  maxPerUser: 1,
  active: true,
};

export interface CouponFormProps {
  /** saveCouponAction bound to the coupon id (null to create). */
  action: (state: FormState<CouponField>, formData: FormData) => Promise<FormState<CouponField>>;
  initial: CouponFormValues;
  mode: "create" | "edit";
}

/**
 * Create / edit a coupon (/admin/coupons/new, /admin/coupons/<id>). The
 * server validates everything again with the same zod schema
 * (src/lib/validations/coupons.ts). The code is set once: orders keep it, so
 * editing shows it but does not send it.
 *
 * Submitted through the action by hand (not `<form action>`), so React does
 * not reset the form after an error: what the admin typed stays.
 */
export function CouponForm({ action, initial, mode }: CouponFormProps) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const formRef = useFocusFirstInvalid(state);
  const [type, setType] = useState(initial.type);
  const [active, setActive] = useState(initial.active);
  const errors = state.fieldErrors ?? {};
  const handled = useRef(state);
  const hydrated = useHydrated();

  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.status === "success" && state.message) showToast.success(state.message);
  }, [state]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-label={mode === "create" ? "Nuevo cupón" : "Editar cupón"} className="space-y-6">
      {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Cupón</h2>
          <CardDescription>El código que escribe el cliente en el carrito o en el checkout.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {mode === "create" ? (
            <Field label="Código" error={errors.code} hint="De 3 a 32 letras, números, - o _. No distingue mayúsculas." required>
              <Input name="code" defaultValue={initial.code} maxLength={32} autoComplete="off" spellCheck={false} className="font-mono uppercase" />
            </Field>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-label text-fg">Código</span>
              <span className="flex h-11 items-center font-mono text-title text-fg" data-testid="coupon-code">
                {initial.code}
              </span>
              <span className="text-caption text-fg-muted">No se puede cambiar: los pedidos lo guardan.</span>
            </div>
          )}
          <Field label="Nota interna" error={errors.description} hint="Para qué es (no la ven los clientes).">
            <Input name="description" defaultValue={initial.description} maxLength={200} autoComplete="off" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Descuento</h2>
          <CardDescription>Se aplica a los productos, nunca al envío. Un porcentaje se redondea al peso.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Tipo" error={errors.type} className="sm:col-span-2" required>
            <RadioGroup value={type} onValueChange={(value) => setType(value as CouponFormValues["type"])} className="grid gap-3 sm:grid-cols-2">
              <RadioGroupItem value="PERCENT" label="Porcentaje" description="Por ejemplo, 10% del subtotal." />
              <RadioGroupItem value="FIXED" label="Monto fijo" description="Pesos de descuento, hasta el subtotal." />
            </RadioGroup>
            <input type="hidden" name="type" value={type} />
          </Field>
          <Field
            label={type === "PERCENT" ? "Porcentaje" : "Monto en pesos"}
            error={errors.value}
            hint={type === "PERCENT" ? "De 1 a 100." : "Sin puntos ni centavos."}
            required
          >
            <Input name="value" type="number" inputMode="numeric" min={1} max={type === "PERCENT" ? 100 : undefined} step={1} defaultValue={initial.value ?? ""} />
          </Field>
          <Field label="Compra mínima" error={errors.minSubtotal} hint="Subtotal de productos desde el que vale. 0 o vacío: cualquiera.">
            <Input name="minSubtotal" type="number" inputMode="numeric" min={0} step={1} defaultValue={initial.minSubtotal || ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Vigencia y límites</h2>
          <CardDescription>
            Un uso cuenta desde que el pedido llega a «Revisar» y vuelve a quedar libre si el pedido se cancela.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Válido desde" error={errors.startsAt} hint="Vacío: desde ya.">
            <Input name="startsAt" type="date" defaultValue={initial.startsAt} />
          </Field>
          <Field label="Válido hasta" error={errors.expiresAt} hint="Incluye ese día. Vacío: sin vencimiento.">
            <Input name="expiresAt" type="date" defaultValue={initial.expiresAt} />
          </Field>
          <Field label="Límite de usos en total" error={errors.maxRedemptions} hint="Vacío: sin límite.">
            <Input name="maxRedemptions" type="number" inputMode="numeric" min={1} step={1} defaultValue={initial.maxRedemptions ?? ""} />
          </Field>
          <Field label="Límite por cliente" error={errors.maxPerUser} hint="Por cuenta, o por email en compras como invitado. Vacío: sin límite.">
            <Input name="maxPerUser" type="number" inputMode="numeric" min={1} step={1} defaultValue={initial.maxPerUser ?? ""} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox label="Activo" description="Desactivado no se puede usar en pedidos nuevos." checked={active} onCheckedChange={setActive} />
            <input type="hidden" name="active" value={active ? "on" : ""} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={!hydrated} data-testid="coupon-save">
          {pending ? "Guardando…" : mode === "create" ? "Crear cupón" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
