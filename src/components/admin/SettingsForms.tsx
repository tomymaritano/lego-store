"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Save } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import type { FormState } from "@/lib/auth/form-state";
import { formatPrice } from "@/lib/utils";
import { ANNOUNCEMENT_TONES, ANNOUNCEMENT_TONE_LABELS, SOCIAL_NETWORKS, type AnnouncementTone, type StoreSettings } from "@/lib/settings/defaults";
import { PLACEHOLDERS } from "@/lib/settings/placeholders";
import type { AnnouncementSettingsField, ContactSettingsField, ShippingSettingsField } from "@/lib/validations/settings";
import { MAX_ANNOUNCEMENT, SOCIAL_FIELDS } from "@/lib/validations/settings-limits";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  showToast,
} from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";
import { useFocusFirstInvalid } from "@/components/auth/useFormFeedback";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";

type SettingsAction<Field extends string> = (state: FormState<Field>, formData: FormData) => Promise<FormState<Field>>;

/**
 * One section of /admin/configuracion as its own form: submitted through
 * its Server Action by hand (React does not reset the fields after an
 * error), the first invalid field focused, success as a toast.
 */
function useSettingsForm<Field extends string>(action: SettingsAction<Field>) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const formRef = useFocusFirstInvalid(state);
  const handled = useRef(state);
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.status === "success" && state.message) showToast.success(state.message);
  }, [state]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };
  const errors: Partial<Record<Field, string>> = state.fieldErrors ?? {};
  return { state, pending, formRef, submit, errors };
}

function SectionCard({ id, title, description, children }: { id: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 id={id} className="text-title text-fg">
          {title}
        </h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">{children}</CardContent>
    </Card>
  );
}

function SaveButton({ pending, testId }: { pending: boolean; testId: string }) {
  const hydrated = useHydrated();
  return (
    <Button type="submit" loading={pending} disabled={!hydrated} data-testid={testId}>
      {pending ? null : <Save aria-hidden="true" />}
      {pending ? "Guardando…" : "Guardar"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Shipping
// ---------------------------------------------------------------------------

export function ShippingSettingsForm({ action, initial }: { action: SettingsAction<ShippingSettingsField>; initial: StoreSettings["shipping"] }) {
  const { state, pending, formRef, submit, errors } = useSettingsForm(action);
  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="settings-shipping" className="space-y-4">
      <SectionCard
        id="settings-shipping"
        title="Envío"
        description="Lo que se cobra por el envío y desde qué subtotal es gratis. Rige para los pedidos que se preparen desde que guardes; los carritos abiertos lo ven al recargar."
      >
        {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Costo del envío (pesos)" error={errors.shippingCost} hint={`Hoy: ${formatPrice(initial.cost)}.`} required>
            <Input name="shippingCost" inputMode="numeric" defaultValue={String(initial.cost)} autoComplete="off" />
          </Field>
          <Field
            label="Envío gratis desde (pesos)"
            error={errors.freeShippingFrom}
            hint={`Subtotal antes de descuentos. Hoy: ${formatPrice(initial.freeFrom)}. Para envío gratis siempre, pon 1.`}
            required
          >
            <Input name="freeShippingFrom" inputMode="numeric" defaultValue={String(initial.freeFrom)} autoComplete="off" />
          </Field>
        </div>
        <SaveButton pending={pending} testId="settings-shipping-save" />
      </SectionCard>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Announcement bar
// ---------------------------------------------------------------------------

export function AnnouncementSettingsForm({
  action,
  initial,
}: {
  action: SettingsAction<AnnouncementSettingsField>;
  /** The whole settings: the preview fills the placeholders with them. */
  initial: StoreSettings;
}) {
  const { state, pending, formRef, submit, errors } = useSettingsForm(action);
  const [draft, setDraft] = useState(initial.announcement);
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const tones = Object.fromEntries(ANNOUNCEMENT_TONES.map((tone) => [tone, ANNOUNCEMENT_TONE_LABELS[tone]]));

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="settings-announcement" className="space-y-4">
      <SectionCard
        id="settings-announcement"
        title="Barra de anuncio"
        description="La franja sobre el encabezado de todas las páginas. Los colores son los del sistema de diseño, con el contraste ya resuelto en tema claro y oscuro."
      >
        {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}
        <Checkbox label="Mostrar la barra" checked={draft.active} onCheckedChange={(checked) => set("active", checked)} />
        <input type="hidden" name="announcementActive" value={draft.active ? "on" : ""} />
        <Field
          label="Texto"
          error={errors.announcementText}
          hint={
            <>
              {draft.text.length} / {MAX_ANNOUNCEMENT}. Puedes usar {"{{envio_gratis_desde}}"} o {"{{costo_envio}}"}: se reemplazan por el valor actual.
            </>
          }
        >
          <Input name="announcementText" value={draft.text} maxLength={MAX_ANNOUNCEMENT} onChange={(event) => set("text", event.target.value)} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Enlace" error={errors.announcementLinkUrl} hint="Opcional. Una ruta del sitio (/envios) o una URL https://.">
            <Input name="announcementLinkUrl" value={draft.linkUrl} spellCheck={false} onChange={(event) => set("linkUrl", event.target.value)} />
          </Field>
          <Field label="Texto del enlace" error={errors.announcementLinkLabel} hint="Por ejemplo: Ver condiciones.">
            <Input name="announcementLinkLabel" value={draft.linkLabel} maxLength={40} onChange={(event) => set("linkLabel", event.target.value)} />
          </Field>
        </div>
        <Field label="Color" error={errors.announcementTone}>
          <Select items={tones} value={draft.tone} onValueChange={(value) => set("tone", (value as AnnouncementTone) ?? "BRAND")}>
            <SelectTrigger className="sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANNOUNCEMENT_TONES.map((tone) => (
                <SelectItem key={tone} value={tone}>
                  {ANNOUNCEMENT_TONE_LABELS[tone]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <input type="hidden" name="announcementTone" value={draft.tone} />

        <div className="space-y-2">
          <p className="text-label font-semibold text-fg" id="announcement-preview-title">
            Vista previa
          </p>
          <div aria-labelledby="announcement-preview-title" role="group" className="overflow-hidden rounded-xl border border-border" data-testid="announcement-preview">
            {draft.active && draft.text.trim() ? (
              <AnnouncementBar announcement={draft} settings={initial} />
            ) : (
              <p className="px-4 py-3 text-label font-normal text-fg-muted">La barra no se muestra.</p>
            )}
          </div>
        </div>
        <SaveButton pending={pending} testId="settings-announcement-save" />
      </SectionCard>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Contact and social profiles
// ---------------------------------------------------------------------------

export function ContactSettingsForm({ action, initial }: { action: SettingsAction<ContactSettingsField>; initial: StoreSettings }) {
  const { state, pending, formRef, submit, errors } = useSettingsForm(action);
  const { contact, social } = initial;
  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="settings-contact" className="space-y-4">
      <SectionCard
        id="settings-contact"
        title="Contacto y redes"
        description="Lo que muestran el pie de página y la página de contacto. Las redes vacías no se muestran."
      >
        {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" error={errors.contactEmail} required>
            <Input name="contactEmail" type="email" defaultValue={contact.email} autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Teléfono" error={errors.contactPhone} hint="Por ejemplo: +54 11 4000-5346." required>
            <Input name="contactPhone" type="tel" defaultValue={contact.phone} autoComplete="off" />
          </Field>
          <Field label="Ubicación" error={errors.contactAddress} required>
            <Input name="contactAddress" defaultValue={contact.address} autoComplete="off" />
          </Field>
          <Field label="Horario de atención" error={errors.contactHours} required>
            <Input name="contactHours" defaultValue={contact.hours} autoComplete="off" />
          </Field>
        </div>
        <fieldset className="space-y-4">
          <legend className="mb-3 text-label font-semibold text-fg">Redes sociales</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {SOCIAL_NETWORKS.map(({ key, name }) => (
              <Field key={key} label={name} error={errors[SOCIAL_FIELDS[key]]} hint="Opcional. URL https://.">
                <Input name={SOCIAL_FIELDS[key]} type="url" defaultValue={social[key]} autoComplete="off" spellCheck={false} />
              </Field>
            ))}
          </div>
        </fieldset>
        <SaveButton pending={pending} testId="settings-contact-save" />
      </SectionCard>
    </form>
  );
}

/** The placeholders the content and the announcement understand (the help under the content editor uses it too). */
export function PlaceholderList({ settings }: { settings: StoreSettings }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-label font-normal sm:grid-cols-2">
      {PLACEHOLDERS.map((placeholder) => (
        <div key={placeholder.key} className="flex flex-wrap items-baseline gap-x-2">
          <dt>
            <code className="rounded bg-bg-muted px-1.5 py-0.5 font-mono text-caption text-fg">{`{{${placeholder.key}}}`}</code>
          </dt>
          <dd className="text-fg-secondary">
            {placeholder.label}: {placeholder.value(settings)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
